'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { OperationalMetricsReport, MetricsDateRange } from '@/lib/observability/metrics';

interface OpsDashboardClientProps {
  initialReport: OperationalMetricsReport;
}

export default function OpsDashboardClient({ initialReport }: OpsDashboardClientProps) {
  const [report, setReport] = useState<OperationalMetricsReport>(initialReport);
  const [range, setRange] = useState<MetricsDateRange>('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<{ id: string; message: string; isError?: boolean } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (selectedRange: MetricsDateRange) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ops/metrics?range=${selectedRange}`);
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
        }
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRangeChange = (newRange: MetricsDateRange) => {
    setRange(newRange);
    fetchMetrics(newRange);
  };

  const handleCopyCorrelationId = (correlationId: string) => {
    navigator.clipboard.writeText(correlationId);
    setCopiedId(correlationId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetryLead = async (leadId: string, correlationId: string) => {
    setRetryingId(correlationId);
    setRetryFeedback(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalCorrelationId: correlationId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRetryFeedback({
          id: correlationId,
          message: 'Retry succeeded! Lead re-analyzed.',
          isError: false,
        });
        // Refresh metrics to reflect new successful execution
        fetchMetrics(range);
      } else {
        setRetryFeedback({
          id: correlationId,
          message: data.error || 'Retry failed. Check cooldown or logs.',
          isError: true,
        });
      }
    } catch {
      setRetryFeedback({
        id: correlationId,
        message: 'Network error while attempting retry.',
        isError: true,
      });
    } finally {
      setRetryingId(null);
    }
  };

  const { overview, latency, tokensAndCost, errors, quality, recentFailures } = report;

  return (
    <div className="space-y-8">
      {/* Date Range Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Telemetry Time Window
          </span>
          {isLoading && (
            <span className="text-xs text-zinc-400 font-mono animate-pulse ml-2">
              Updating…
            </span>
          )}
        </div>

        <div className="inline-flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200">
          {(['24h', '7d', '30d', 'all'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRangeChange(r)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                range === r
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {r === '24h' ? 'Last 24h' : r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Executions */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Total Executions
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-zinc-900 font-mono">
              {overview.totalExecutions}
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-500">
              {overview.retryCount > 0 ? `${overview.retryCount} retries` : '0 retries'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium pt-1">
            Gemini analysis runs requested
          </p>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Success Rate
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600 font-mono">
              {overview.successRate}%
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-500">
              {overview.successfulExecutions} ok / {overview.failedExecutions} err
            </span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${overview.successRate}%` }}
            ></div>
          </div>
        </div>

        {/* Latency (Avg & P90) */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Latency (Avg &bull; P90)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-zinc-900 font-mono">
              {latency.avgMs}ms
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-500">
              P90: {latency.p90Ms}ms
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium pt-1 font-mono">
            Min {latency.minMs}ms &bull; Max {latency.maxMs}ms
          </p>
        </div>

        {/* Tokens & Estimated AI Cost */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Estimated AI Cost
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#C84B45] font-mono">
              ${tokensAndCost.estimatedTotalCostUsd.toFixed(4)}
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-500">
              ~${tokensAndCost.avgCostPerExecutionUsd.toFixed(4)}/run
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium pt-1 font-mono truncate">
            {tokensAndCost.totalTokens.toLocaleString()} tokens consumed
          </p>
        </div>
      </div>

      {/* Diagnostics Grid: Errors & Extraction Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Breakdown Card */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-extrabold tracking-tight text-zinc-900">
              Error Distribution by Category
            </h3>
            <span className="text-xs font-mono font-bold text-zinc-400">
              {errors.totalErrors} Total Errors
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Timeout Errors
              </span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {errors.timeoutErrors}
              </span>
              <p className="text-[10px] text-zinc-400">Socket aborted (&gt;15s)</p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Validation Errors
              </span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {errors.validationErrors}
              </span>
              <p className="text-[10px] text-zinc-400">Schema / JSON parse failures</p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Provider Errors
              </span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {errors.providerErrors}
              </span>
              <p className="text-[10px] text-zinc-400">Quota 429 / 5xx / Network</p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Internal Errors
              </span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {errors.internalErrors}
              </span>
              <p className="text-[10px] text-zinc-400">Application runtime exceptions</p>
            </div>
          </div>
        </div>

        {/* Extraction Quality Trends Card */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-extrabold tracking-tight text-zinc-900">
              Extraction Quality &amp; Confidence
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-600">
              {quality.cleanExtractionsRate}% High-Confidence
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 font-medium">Clean Extractions (0 uncertain fields)</span>
              <span className="font-mono font-bold text-zinc-900">
                {quality.cleanExtractionsCount} / {quality.totalAnalyzed}
              </span>
            </div>

            <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${quality.cleanExtractionsRate}%` }}
              ></div>
            </div>

            {Object.keys(quality.uncertainFieldsBreakdown).length > 0 && (
              <div className="pt-2 border-t border-zinc-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                  Most Common Uncertain Fields
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(quality.uncertainFieldsBreakdown).map(([field, count]) => (
                    <span
                      key={field}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-mono font-semibold"
                    >
                      {field}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Failed Executions Table (Troubleshooting & Recovery) */}
      <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-zinc-900">
              Recent Failed Executions &amp; Recovery
            </h3>
            <p className="text-xs text-zinc-500 font-medium">
              Investigate correlation IDs, error types, and safely retry transient failures under cooldown.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700">
            {recentFailures.length} Logged Failures
          </span>
        </div>

        {recentFailures.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-1">
              &check;
            </div>
            <p className="text-sm font-bold text-zinc-800">No Failed Executions</p>
            <p className="text-xs text-zinc-500">All AI lead analyses in this window completed successfully.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 border-b border-zinc-200/80 text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Lead</th>
                  <th className="py-3 px-4">Error Category</th>
                  <th className="py-3 px-4">Correlation ID</th>
                  <th className="py-3 px-4">Sanitized Reason</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentFailures.map((failure) => (
                  <tr key={failure.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-zinc-500 whitespace-nowrap">
                      {new Date(failure.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 whitespace-nowrap">
                      <Link
                        href={`/leads/${failure.leadId}`}
                        className="hover:text-[#C84B45] underline decoration-zinc-300 underline-offset-2"
                      >
                        {failure.leadName}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                          failure.errorType === 'TIMEOUT_ERROR'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : failure.errorType === 'PROVIDER_ERROR'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : failure.errorType === 'VALIDATION_ERROR'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {failure.errorType || 'INTERNAL_ERROR'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-600 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleCopyCorrelationId(failure.correlationId)}
                        className="inline-flex items-center gap-1 hover:text-zinc-900 px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 cursor-pointer"
                        title="Click to copy full correlation ID"
                      >
                        <span>{failure.correlationId.slice(0, 8)}…</span>
                        <span className="text-[9px] text-zinc-400">
                          {copiedId === failure.correlationId ? 'copied!' : 'copy'}
                        </span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 max-w-xs truncate" title={failure.errorMessage || ''}>
                      {failure.errorMessage || 'No error details recorded'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRetryLead(failure.leadId, failure.correlationId)}
                        disabled={retryingId === failure.correlationId}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                      >
                        {retryingId === failure.correlationId ? 'Retrying…' : 'Retry'}
                      </button>
                      {retryFeedback && retryFeedback.id === failure.correlationId && (
                        <p
                          className={`text-[10px] mt-1 ${
                            retryFeedback.isError ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {retryFeedback.message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
