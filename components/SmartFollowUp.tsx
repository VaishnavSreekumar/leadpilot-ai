'use client';

import { useState, useCallback } from 'react';

interface FollowUpData {
  recommendedAt: string | null;
  daysFromNow: number;
  reason: string;
  focusPoints: string[];
  suggestedMessage: string;
  generatedAt: string;
}

interface SmartFollowUpProps {
  leadId: string;
  leadName: string;
  initialFollowUp?: FollowUpData | null;
}

export default function SmartFollowUp({
  leadId,
  leadName,
  initialFollowUp = null,
}: SmartFollowUpProps) {
  const [followUp, setFollowUp] = useState<FollowUpData | null>(initialFollowUp);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preserved, setPreserved] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(
    async (force: boolean) => {
      setIsLoading(true);
      setError(null);
      setPreserved(false);

      try {
        const res = await fetch(`/api/leads/${leadId}/follow-up`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force }),
        });

        const data = await res.json();

        if (res.status === 429) {
          setError(`${data.error ?? 'Please wait before regenerating.'}`);
          return;
        }

        if (!res.ok && !data.followUp) {
          setError(data.error ?? 'Failed to generate follow-up. Please try again.');
          return;
        }

        if (data.followUp) {
          setFollowUp(data.followUp);
          if (data.preserved) {
            setPreserved(true);
            setError('Regeneration failed — showing previous recommendation.');
          }
        }
      } catch {
        setError('Network error. Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [leadId]
  );

  const copyMessage = useCallback(async () => {
    if (!followUp?.suggestedMessage) return;
    try {
      await navigator.clipboard.writeText(followUp.suggestedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS or restricted environments
      const ta = document.createElement('textarea');
      ta.value = followUp.suggestedMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [followUp]);

  const generatedDate = followUp?.generatedAt
    ? new Date(followUp.generatedAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Smart Follow-Up
          </h2>
        </div>

        {followUp && !isLoading && (
          <button
            id="smart-follow-up-regenerate-btn"
            onClick={() => generate(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors font-medium"
          >
            Regenerate
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Empty state */}
        {!followUp && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-950/50 border border-amber-900/40 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200 mb-1">No follow-up recommendation yet</p>
              <p className="text-xs text-zinc-500">
                Generate a recommended follow-up plan for {leadName}
              </p>
            </div>
            <button
              id="smart-follow-up-generate-btn"
              onClick={() => generate(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Generate Follow-Up
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Generating follow-up recommendation…</p>
          </div>
        )}

        {/* Error state (no preserved data) */}
        {error && !followUp && (
          <div className="rounded-lg bg-rose-950/40 border border-rose-800/40 p-4 mb-4">
            <p className="text-sm text-rose-400">{error}</p>
            <button
              onClick={() => { setError(null); generate(false); }}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Generated state */}
        {followUp && !isLoading && (
          <div className="space-y-5">
            {/* Preserved / partial-failure notice */}
            {preserved && error && (
              <div className="rounded-lg bg-amber-950/30 border border-amber-800/40 px-4 py-2.5">
                <p className="text-xs text-amber-400">{error}</p>
              </div>
            )}

            {/* Timing card */}
            <div className="rounded-lg bg-amber-950/20 border border-amber-800/30 px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-900/50 border border-amber-700/40 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/70 mb-0.5">
                  Recommended Follow-Up
                </p>
                <p className="text-lg font-bold text-amber-300">
                  in {followUp.daysFromNow} day{followUp.daysFromNow !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Reason</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{followUp.reason}</p>
            </div>

            {/* Focus points */}
            {followUp.focusPoints.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Focus Points</p>
                <ul className="space-y-1.5">
                  {followUp.focusPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested message */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Suggested Message</p>
                <button
                  id="smart-follow-up-copy-btn"
                  onClick={copyMessage}
                  className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Message
                    </>
                  )}
                </button>
              </div>
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-4 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono text-xs">
                {followUp.suggestedMessage}
              </div>
            </div>

            {/* Footer metadata */}
            {generatedDate && (
              <p className="text-xs text-zinc-600 font-mono pt-1">
                Generated: {generatedDate}
              </p>
            )}
          </div>
        )}

        {/* Generate button when in error state with no data */}
        {!followUp && !isLoading && !error && null}
      </div>
    </div>
  );
}
