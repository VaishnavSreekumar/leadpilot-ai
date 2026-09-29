import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeLeadWithGemini } from '@/lib/ai/lead-analysis';
import { calculateLeadScore } from '@/lib/scoring/lead-score';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid Lead ID is required' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Parse optional request options (e.g. force/retry)
    let isForceRetry = false;
    try {
      const body = await request.json();
      if (body && typeof body.force === 'boolean') {
        isForceRetry = body.force;
      }
    } catch {
      // Body is optional; no-op if empty or non-JSON
    }

    // 11. Cost Guard / Re-analysis Policy:
    // If analysis is already completed and this is NOT an explicit retry, reuse existing result
    if (lead.aiAnalysisStatus === 'COMPLETED' && !isForceRetry) {
      const scoreResult = calculateLeadScore({
        intentLevel: lead.aiIntentLevel,
        buyingTimeline: lead.buyingTimeline,
        budgetInr: lead.budgetInr,
        requirementClarity: lead.aiRequirementClarity,
        engagementLevel: lead.aiEngagementLevel,
      });

      return NextResponse.json(
        {
          success: true,
          lead,
          breakdown: scoreResult.breakdown,
          message: 'Existing completed analysis reused.',
        },
        { status: 200 }
      );
    }

    // Cooldown Guard (10 seconds) to prevent duplicate clicks from public demo visitors
    if (lead.aiAnalyzedAt) {
      const secondsSinceLastAnalysis = (Date.now() - new Date(lead.aiAnalyzedAt).getTime()) / 1000;
      if (secondsSinceLastAnalysis < 10) {
        return NextResponse.json(
          {
            error: 'Cooldown active. Please wait 10 seconds before requesting another analysis.',
            cooldownRemaining: Math.ceil(10 - secondsSinceLastAnalysis),
          },
          { status: 429 }
        );
      }
    }

    // Mark as PENDING during active generation
    await prisma.lead.update({
      where: { id },
      data: { aiAnalysisStatus: 'PENDING' },
    });

    try {
      // Execute Gemini analysis with bounded retry (max 2 attempts inside analyzeLeadWithGemini)
      const analysis = await analyzeLeadWithGemini({
        name: lead.name,
        location: lead.location,
        propertyRequirement: lead.propertyRequirement,
        budgetInr: lead.budgetInr,
        buyingTimeline: lead.buyingTimeline,
        customerMessage: lead.customerMessage,
      });

      // Calculate deterministic lead score & priority
      const scoreResult = calculateLeadScore({
        intentLevel: analysis.intentLevel,
        buyingTimeline: lead.buyingTimeline,
        budgetInr: lead.budgetInr,
        requirementClarity: analysis.requirementClarity,
        engagementLevel: analysis.engagementLevel,
      });

      // Persist AI fields and canonical scoring fields (zero breakdown persisted)
      const updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          aiSummary: analysis.summary,
          aiIntent: analysis.intent,
          aiKeyRequirements: analysis.keyRequirements,
          aiObjections: analysis.objections,
          aiRecommendedNextAction: analysis.recommendedNextAction,
          aiSuggestedResponse: analysis.suggestedResponse,
          aiSuggestedQuestions: analysis.suggestedQuestions,
          aiIntentLevel: analysis.intentLevel,
          aiEngagementLevel: analysis.engagementLevel,
          aiRequirementClarity: analysis.requirementClarity,
          aiAnalyzedAt: new Date(),
          aiAnalysisStatus: 'COMPLETED',
          leadScore: scoreResult.score,
          leadPriority: scoreResult.priority,
        },
      });

      return NextResponse.json(
        {
          success: true,
          lead: updatedLead,
          breakdown: scoreResult.breakdown,
        },
        { status: 200 }
      );
    } catch (analysisError) {
      const errMessage = analysisError instanceof Error ? analysisError.message : 'AI generation failed';
      console.error('[Analyze Lead Processing Error]:', errMessage);

      // Failure Safety:
      // If a previous COMPLETED analysis existed, preserve it.
      // Otherwise set aiAnalysisStatus to FAILED.
      if (lead.aiAnalysisStatus !== 'COMPLETED') {
        await prisma.lead.update({
          where: { id },
          data: { aiAnalysisStatus: 'FAILED' },
        });
      }

      return NextResponse.json(
        {
          error: 'AI analysis temporarily unavailable. Please retry shortly.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Server error';
    console.error('[POST /api/leads/[id]/analyze Fatal Error]:', errMessage);

    return NextResponse.json(
      { error: 'An unexpected error occurred while analyzing the lead.' },
      { status: 500 }
    );
  }
}
