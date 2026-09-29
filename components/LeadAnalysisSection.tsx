'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculateLeadScore, type ScoreResult } from '@/lib/scoring/lead-score';

interface LeadAnalysisSectionProps {
  leadId: string;
  initialStatus: string | null;
  initialAiSummary: string | null;
  initialAiIntent: string | null;
  initialAiKeyRequirements: string[];
  initialAiObjections: string[];
  initialAiRecommendedNextAction: string | null;
  initialAiSuggestedResponse: string | null;
  initialAiIntentLevel: string | null;
  initialAiEngagementLevel: string | null;
  initialAiRequirementClarity: string | null;
  initialLeadScore: number | null;
  initialLeadPriority: string | null;
  initialAnalyzedAt: string | Date | null;
  // Lead base fields for breakdown calculation
  buyingTimeline: string;
  budgetInr: number;
}

export default function LeadAnalysisSection({
  leadId,
  initialStatus,
  initialAiSummary,
  initialAiIntent,
  initialAiKeyRequirements,
  initialAiObjections,
  initialAiRecommendedNextAction,
  initialAiSuggestedResponse,
  initialAiIntentLevel,
  initialAiEngagementLevel,
  initialAiRequirementClarity,
  initialLeadScore,
  initialLeadPriority,
  initialAnalyzedAt,
  buyingTimeline,
  budgetInr,
}: LeadAnalysisSectionProps) {
  const router = useRouter();

  const [status, setStatus] = useState<string>(initialStatus || 'PENDING');
  const [summary, setSummary] = useState<string | null>(initialAiSummary);
  const [intent, setIntent] = useState<string | null>(initialAiIntent);
  const [keyRequirements, setKeyRequirements] = useState<string[]>(initialAiKeyRequirements || []);
  const [objections, setObjections] = useState<string[]>(initialAiObjections || []);
  const [recommendedNextAction, setRecommendedNextAction] = useState<string | null>(initialAiRecommendedNextAction);
  const [suggestedResponse, setSuggestedResponse] = useState<string | null>(initialAiSuggestedResponse);
  const [intentLevel, setIntentLevel] = useState<string | null>(initialAiIntentLevel);
  const [engagementLevel, setEngagementLevel] = useState<string | null>(initialAiEngagementLevel);
  const [requirementClarity, setRequirementClarity] = useState<string | null>(initialAiRequirementClarity);
  const [score, setScore] = useState<number | null>(initialLeadScore);
  const [priority, setPriority] = useState<string | null>(initialLeadPriority);
  const [analyzedAt, setAnalyzedAt] = useState<string | Date | null>(initialAnalyzedAt);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  // 10-second cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);


  // Derive score breakdown deterministically at render time
  let derivedScore: ScoreResult | null = null;
  if (status === 'COMPLETED' && intentLevel && requirementClarity && engagementLevel) {
    derivedScore = calculateLeadScore({
      intentLevel,
      buyingTimeline,
      budgetInr,
      requirementClarity,
      engagementLevel,
    });
  }

  const handleAnalyze = async (forceRetry = false) => {
    if (isLoading || cooldownSeconds > 0) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: forceRetry }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(data.error || 'Please wait a few seconds before retrying.');
          if (data.retryAfter) {
            setCooldownSeconds(data.retryAfter);
          } else {
            setCooldownSeconds(10);
          }
        } else {
          setStatus('FAILED');
          setErrorMessage('AI analysis temporarily unavailable.');
        }
        return;
      }

      if (data && data.lead) {
        const updated = data.lead;
        setStatus(updated.aiAnalysisStatus || 'COMPLETED');
        setSummary(updated.aiSummary);
        setIntent(updated.aiIntent);
        setKeyRequirements(updated.aiKeyRequirements || []);
        setObjections(updated.aiObjections || []);
        setRecommendedNextAction(updated.aiRecommendedNextAction);
        setSuggestedResponse(updated.aiSuggestedResponse);
        setIntentLevel(updated.aiIntentLevel);
        setEngagementLevel(updated.aiEngagementLevel);
        setRequirementClarity(updated.aiRequirementClarity);
        setScore(updated.leadScore);
        setPriority(updated.leadPriority);
        setAnalyzedAt(updated.aiAnalyzedAt);
        setCooldownSeconds(10); // Start 10s cooldown
        router.refresh();
      }
    } catch {
      setStatus('FAILED');
      setErrorMessage('AI analysis temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!suggestedResponse) return;
    try {
      await navigator.clipboard.writeText(suggestedResponse);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    } catch {
      // Fallback
    }
  };

  const getPriorityBadgeClass = (pri: string | null) => {
    switch (pri) {
      case 'HOT':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'WARM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'COLD':
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    }
  };

  // State: COMPLETED
  if (status === 'COMPLETED' && summary) {
    const formattedAnalyzedDate = analyzedAt
      ? new Date(analyzedAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    return (
      <div className="space-y-6">
        {/* Top Header Card: Score & Priority Overview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  AI Lead Analysis &amp; Scoring
                </span>
                {formattedAnalyzedDate && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    &bull; Analyzed {formattedAnalyzedDate}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Sales Readiness Score
              </h2>
              <p className="text-xs text-zinc-400">
                Explainable, deterministic heuristic derived from AI intent extraction and intake parameters.
              </p>
            </div>

            {/* Score & Priority Display */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1.5 font-mono">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {score ?? derivedScore?.score ?? '--'}
                  </span>
                  <span className="text-sm font-semibold text-zinc-500">/ 100</span>
                </div>
                <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  Lead Score
                </p>
              </div>

              <div
                className={`px-3.5 py-2 rounded-lg border font-bold text-sm tracking-wider uppercase ${getPriorityBadgeClass(
                  priority || derivedScore?.priority || 'COLD'
                )}`}
              >
                {priority || derivedScore?.priority || 'COLD'}
              </div>
            </div>
          </div>

          {/* Derived Score Breakdown (Section 17) */}
          {derivedScore && (
            <div className="pt-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Deterministic Score Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* Intent */}
                <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5">
                  <span className="text-[11px] text-zinc-500 block uppercase tracking-wider">Intent</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-medium text-zinc-200">{intentLevel}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{derivedScore.breakdown.intent.points}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5">
                  <span className="text-[11px] text-zinc-500 block uppercase tracking-wider">Timeline</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-medium text-zinc-200 truncate">{buyingTimeline}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{derivedScore.breakdown.timeline.points}
                    </span>
                  </div>
                </div>

                {/* Budget */}
                <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5">
                  <span className="text-[11px] text-zinc-500 block uppercase tracking-wider">Budget</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-medium text-zinc-200">Valid</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{derivedScore.breakdown.budget.points}
                    </span>
                  </div>
                </div>

                {/* Requirements */}
                <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5">
                  <span className="text-[11px] text-zinc-500 block uppercase tracking-wider">Clarity</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-medium text-zinc-200">{requirementClarity}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{derivedScore.breakdown.requirements.points}
                    </span>
                  </div>
                </div>

                {/* Engagement */}
                <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-zinc-500 block uppercase tracking-wider">Engagement</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-medium text-zinc-200">{engagementLevel}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{derivedScore.breakdown.engagement.points}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Why this lead is prioritized (Section 8) */}
          {derivedScore && derivedScore.reasons.length > 0 && (
            <div className="pt-5 mt-5 border-t border-zinc-800/80 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Why this lead is prioritized:
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {derivedScore.reasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-xs text-zinc-200 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800/60"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* AI Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
              Lead Summary
            </span>
            <p className="text-sm text-zinc-200 leading-relaxed">
              {summary}
            </p>
          </div>

          {/* Customer Intent */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
              Customer Intent
            </span>
            <p className="text-sm text-zinc-200 leading-relaxed">
              {intent}
            </p>
          </div>

          {/* Key Requirements */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
              Key Requirements
            </span>
            {keyRequirements.length > 0 ? (
              <ul className="space-y-1.5">
                {keyRequirements.map((req, idx) => (
                  <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">&bull;</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500 italic">None explicitly identified</p>
            )}
          </div>

          {/* Objections / Concerns */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
              Objections / Identified Constraints
            </span>
            {objections.length > 0 ? (
              <ul className="space-y-1.5">
                {objections.map((obj, idx) => (
                  <li key={idx} className="text-sm text-amber-300/90 flex items-start gap-2">
                    <span className="text-amber-400 mt-1">&bull;</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500 italic">No explicit objections noted</p>
            )}
          </div>
        </div>

        {/* Action & Response Recommendations */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          {/* Recommended Next Action */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
              Recommended Next Action
            </span>
            <p className="text-sm font-medium text-zinc-100 bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-800/80">
              {recommendedNextAction}
            </p>
          </div>

          {/* Suggested Response */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Suggested Salesperson Response
              </span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
              >
                {copiedResponse ? (
                  <span className="text-emerald-400">&check; Copied!</span>
                ) : (
                  <span>Copy Text</span>
                )}
              </button>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {suggestedResponse}
            </div>
          </div>
        </div>

        {/* Footer Actions: Re-analysis & Cooldown Guard */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-xs text-zinc-500">
            Analysis is cached. Explicit re-analysis re-invokes Gemini with current lead parameters.
          </p>
          <button
            type="button"
            onClick={() => handleAnalyze(true)}
            disabled={isLoading || cooldownSeconds > 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-zinc-300 border border-zinc-700/60 transition-colors"
          >
            {isLoading ? (
              <span>Analyzing lead...</span>
            ) : cooldownSeconds > 0 ? (
              <span>Retry Analysis ({cooldownSeconds}s)</span>
            ) : (
              <span>Retry Analysis</span>
            )}
          </button>
        </div>

        {errorMessage && (
          <p className="text-xs text-rose-400 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  // State: FAILED
  if (status === 'FAILED') {
    return (
      <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-rose-900/40 border border-rose-700/50 flex items-center justify-center text-rose-400 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rose-200">
              AI analysis temporarily unavailable.
            </h3>
            <p className="text-xs text-rose-300/80 mt-1">
              The AI service could not complete the request. Your lead record is intact and safe.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => handleAnalyze(true)}
            disabled={isLoading || cooldownSeconds > 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-sm"
          >
            {isLoading ? (
              <span>Analyzing lead...</span>
            ) : cooldownSeconds > 0 ? (
              <span>Retry Analysis ({cooldownSeconds}s)</span>
            ) : (
              <span>Retry Analysis</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // State: PENDING or Unanalyzed
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              AI analysis pending
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Run Gemini AI analysis to evaluate buyer intent, calculate sales readiness score, and generate actionable recommendations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleAnalyze(false)}
          disabled={isLoading || cooldownSeconds > 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-sm shrink-0"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Analyzing lead...</span>
            </span>
          ) : cooldownSeconds > 0 ? (
            <span>Wait ({cooldownSeconds}s)</span>
          ) : (
            <span>Analyze Lead</span>
          )}
        </button>
      </div>

      {errorMessage && (
        <p className="text-xs text-rose-400 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
