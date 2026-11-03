import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { registerSchema } from '@/lib/validations/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from '@/lib/auth/session';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. IP-based rate limiting (10 registrations / 60 seconds per IP)
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit({
      key: `ip:${clientIp}:auth_register`,
      maxRequests: 10,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit, 'Too many registration attempts. Please wait.');
    }

    // 2. Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload in request body' }, { status: 400 });
    }

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // 3. Check for existing account
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 409 }
      );
    }

    // 4. Create user with hashed password
    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // 5. Create session
    const { token, expiresAt } = await createSession(user.id);

    // 6. Return response with HTTP-only cookie
    const response = NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration error';
    console.error('[POST /api/auth/register Error]:', message);
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration. Please try again.' },
      { status: 500 }
    );
  }
}

