import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { leadInputSchema } from '@/lib/validations/lead';
import { getCurrentUser } from '@/lib/auth/session';
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Server-side Rate Limiting (30 lead creations / 60s per user)
    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:create_lead`,
      maxRequests: 30,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit, 'Rate limit exceeded for lead creation. Please wait.');
    }

    // 3. Body validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const validationResult = leadInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 4. Save lead linked to the authenticated user
    const newLead = await prisma.lead.create({
      data: {
        ...validationResult.data,
        userId: user.id,
      },
    });

    return NextResponse.json(newLead, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database operation failed';
    console.error('[POST /api/leads Error]:', message);

    return NextResponse.json(
      { error: 'Failed to create lead. Please try again later.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // 1. Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Rate limiting (60 fetches / 60s per user)
    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:get_leads`,
      maxRequests: 60,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit);
    }

    // 3. Fetch user's leads (strictly isolated to the authenticated user)
    const leads = await prisma.lead.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [
        { leadScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ leads }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database query failed';
    console.error('[GET /api/leads Error]:', message);

    return NextResponse.json(
      { error: 'Failed to fetch leads. Please try again later.' },
      { status: 500 }
    );
  }
}
