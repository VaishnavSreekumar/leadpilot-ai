import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/validations/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from '@/lib/auth/session';
import { checkRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. IP-based rate limiting (10 login attempts / 60 seconds per IP)
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit({
      key: `ip:${clientIp}:auth_login`,
      maxRequests: 10,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit, 'Too many login attempts. Please wait before retrying.');
    }

    // 2. Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload in request body' }, { status: 400 });
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // 3. Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 4. Verify password with constant-time comparison
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 5. Create new session
    const { token, expiresAt } = await createSession(user.id);

    // 6. Return response with session cookie
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 200 }
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
    const message = error instanceof Error ? error.message : 'Login error';
    console.error('[POST /api/auth/login Error]:', message);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}

