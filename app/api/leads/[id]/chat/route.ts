import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chatRequestSchema, chatWithSalesAssistant } from '@/lib/ai/sales-assistant';
import { getCurrentUser } from '@/lib/auth/session';
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { acquireLeadCooldown, releaseLeadCooldown } from '@/lib/reliability/cooldown';

export const dynamic = 'force-dynamic';

// 5-second minimum cooldown per lead (persisted in DB — serverless safe)
const CHAT_COOLDOWN_MS = 5000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid Lead ID is required' }, { status: 400 });
    }

    // 2. Server-side Rate Limiting (30 chat requests / 60s per user)
    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:chat`,
      maxRequests: 30,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit, 'Rate limit exceeded for sales assistant chat. Please wait.');
    }

    // --- Parse and validate request body ---
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with "message" and optional "history".' },
        { status: 400 }
      );
    }

    const validation = chatRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      const rootErrors = validation.error.flatten().formErrors;
      return NextResponse.json(
        {
          error: 'Request validation failed',
          details: { ...fieldErrors, ...(rootErrors.length > 0 ? { _: rootErrors } : {}) },
        },
        { status: 400 }
      );
    }

    const { message, history } = validation.data;

    // --- Retrieve authoritative lead from DB (server-side — browser cannot influence this) ---
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 3. Cross-user IDOR protection
    if (lead.userId && lead.userId !== user.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // --- Persistent serverless-safe atomic cooldown check ---
    // Guaranteed atomic in PostgreSQL via conditional row update
    const previousChatRequestAt = lead.lastChatRequestAt;
    const cooldownLock = await acquireLeadCooldown(id, 'lastChatRequestAt', CHAT_COOLDOWN_MS);
    if (!cooldownLock.acquired) {
      const cooldownRemaining = cooldownLock.cooldownRemaining ?? 5;
      return NextResponse.json(
        {
          error: `Please wait ${cooldownRemaining} second${cooldownRemaining !== 1 ? 's' : ''} before sending another message.`,
          cooldownRemaining,
        },
        { status: 429 }
      );
    }

    // --- Call Gemini (failure MUST NOT mutate lead AI analysis or scoring fields) ---
    try {
      const chatResult = await chatWithSalesAssistant(
        {
          id: lead.id,
          name: lead.name,
          location: lead.location,
          propertyRequirement: lead.propertyRequirement,
          budgetInr: lead.budgetInr,
          buyingTimeline: lead.buyingTimeline,
          customerMessage: lead.customerMessage,
          aiSummary: lead.aiSummary,
          aiIntent: lead.aiIntent,
          aiKeyRequirements: lead.aiKeyRequirements,
          aiObjections: lead.aiObjections,
          aiRecommendedNextAction: lead.aiRecommendedNextAction,
          aiSuggestedResponse: lead.aiSuggestedResponse,
          aiIntentLevel: lead.aiIntentLevel,
          aiEngagementLevel: lead.aiEngagementLevel,
          aiRequirementClarity: lead.aiRequirementClarity,
          aiAnalyzedAt: lead.aiAnalyzedAt,
          aiAnalysisStatus: lead.aiAnalysisStatus,
          leadScore: lead.leadScore,
          leadPriority: lead.leadPriority,
        },
        history,
        message
      );

      return NextResponse.json(
        {
          answer: chatResult.answer,
          suggestedQuestions: chatResult.suggestedQuestions ?? [],
        },
        { status: 200 }
      );
    } catch (chatError) {
      const errMessage = chatError instanceof Error ? chatError.message : 'AI chat failed';
      console.error('[Sales Assistant Chat Error]:', errMessage);

      // Release cooldown using CAS so users are not blocked on provider failures
      await releaseLeadCooldown(id, 'lastChatRequestAt', cooldownLock.acquiredAt, previousChatRequestAt);

      return NextResponse.json(
        {
          error:
            'The sales assistant is temporarily unavailable. Please try again shortly. Your lead record is unaffected.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Server error';
    console.error('[POST /api/leads/[id]/chat Fatal Error]:', errMessage);

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
