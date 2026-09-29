import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  followUpRequestSchema,
  generateFollowUpAi,
  getFollowUpDate,
  getFollowUpDays,
} from '@/lib/ai/follow-up';

export const dynamic = 'force-dynamic';

// 30-second regeneration cooldown (persisted in DB — serverless safe)
const FOLLOW_UP_REGEN_COOLDOWN_MS = 30_000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid Lead ID is required' }, { status: 400 });
    }

    // --- Parse and validate request body ---
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      // Empty body is allowed — treat as { force: false }
      rawBody = {};
    }

    const validation = followUpRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: 'Request validation failed', details: fieldErrors },
        { status: 400 }
      );
    }

    const { force } = validation.data;

    // --- Retrieve authoritative lead from DB ---
    const lead = await prisma.lead.findUnique({ where: { id } });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // --- Calculate deterministic follow-up timing (application logic, not AI) ---
    const followUpDays = getFollowUpDays(lead.buyingTimeline, lead.leadPriority);
    const recommendedAt = getFollowUpDate(lead.buyingTimeline, lead.leadPriority);

    // --- Cache check ---
    // Return existing recommendation unless force=true is explicitly requested.
    if (!force && lead.followUpGeneratedAt && lead.followUpReason) {
      return NextResponse.json({
        success: true,
        cached: true,
        followUp: {
          recommendedAt: lead.followUpRecommendedAt,
          daysFromNow: followUpDays,
          reason: lead.followUpReason,
          focusPoints: lead.followUpFocusPoints ?? [],
          suggestedMessage: lead.followUpMessage ?? '',
          generatedAt: lead.followUpGeneratedAt,
        },
      });
    }

    // --- Regeneration cooldown (serverless-safe: DB-backed) ---
    // Prevent rapid re-generation hammering the Gemini API.
    if (force && lead.followUpGeneratedAt) {
      const msSinceLastGen = Date.now() - new Date(lead.followUpGeneratedAt).getTime();
      if (msSinceLastGen < FOLLOW_UP_REGEN_COOLDOWN_MS) {
        const secondsRemaining = Math.ceil((FOLLOW_UP_REGEN_COOLDOWN_MS - msSinceLastGen) / 1000);
        return NextResponse.json(
          {
            error: `Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''} before regenerating.`,
            cooldownRemaining: secondsRemaining,
          },
          { status: 429 }
        );
      }
    }

    // --- Call Gemini (failure MUST NOT mutate AI analysis or scoring fields) ---
    // Snapshot the existing recommendation BEFORE the AI call so we can preserve it on failure.
    const previousRecommendation =
      lead.followUpGeneratedAt && lead.followUpReason
        ? {
            followUpRecommendedAt: lead.followUpRecommendedAt,
            followUpReason: lead.followUpReason,
            followUpFocusPoints: lead.followUpFocusPoints,
            followUpMessage: lead.followUpMessage,
            followUpGeneratedAt: lead.followUpGeneratedAt,
          }
        : null;

    try {
      const aiResult = await generateFollowUpAi(
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
          aiAnalysisStatus: lead.aiAnalysisStatus,
          leadScore: lead.leadScore,
          leadPriority: lead.leadPriority,
        },
        followUpDays
      );

      const now = new Date();

      // Persist ONLY the follow-up fields — never aiSummary, leadScore, etc.
      await prisma.lead.update({
        where: { id },
        data: {
          followUpRecommendedAt: recommendedAt,
          followUpReason: aiResult.reason,
          followUpFocusPoints: aiResult.focusPoints,
          followUpMessage: aiResult.suggestedMessage,
          followUpGeneratedAt: now,
        },
      });

      return NextResponse.json({
        success: true,
        cached: false,
        followUp: {
          recommendedAt,
          daysFromNow: followUpDays,
          reason: aiResult.reason,
          focusPoints: aiResult.focusPoints,
          suggestedMessage: aiResult.suggestedMessage,
          generatedAt: now,
        },
      });
    } catch (aiError) {
      // AI failed — preserve any previous valid recommendation.
      const errMessage = aiError instanceof Error ? aiError.message : 'AI generation failed';
      console.error('[Smart Follow-Up Generation Error]:', errMessage);

      if (previousRecommendation) {
        // Return the preserved previous recommendation — do NOT return null/garbage.
        return NextResponse.json(
          {
            success: false,
            cached: true,
            preserved: true,
            error: 'Follow-up regeneration failed. Showing the previous recommendation.',
            followUp: {
              recommendedAt: previousRecommendation.followUpRecommendedAt,
              daysFromNow: followUpDays,
              reason: previousRecommendation.followUpReason,
              focusPoints: previousRecommendation.followUpFocusPoints ?? [],
              suggestedMessage: previousRecommendation.followUpMessage ?? '',
              generatedAt: previousRecommendation.followUpGeneratedAt,
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          error:
            'Smart Follow-Up generation is temporarily unavailable. Please try again shortly. Your lead record is unaffected.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Server error';
    console.error('[POST /api/leads/[id]/follow-up Fatal Error]:', errMessage);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
