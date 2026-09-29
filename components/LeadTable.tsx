'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LeadRecord } from '@/types';
import { formatBudgetDisplay, getTimelineLabel } from '@/lib/validations/lead';
import { getLeadExplanation } from '@/lib/scoring/lead-score';

type PriorityFilter = 'ALL' | 'HOT' | 'WARM' | 'COLD' | 'PENDING';

interface LeadTableProps {
  leads: LeadRecord[];
}

export default function LeadTable({ leads }: LeadTableProps) {
  const [filter, setFilter] = useState<PriorityFilter>('ALL');

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-200">No leads yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Add your first inbound real-estate lead to start building your sales queue.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <span>+ Add Lead</span>
          </Link>
        </div>
      </div>
    );
  }

  // Counts based strictly on canonical rule:
  // Pending Analysis = leadScore IS NULL (NOT aiAnalysisStatus !== 'COMPLETED')
  const totalCount = leads.length;
  const hotCount = leads.filter((l) => l.leadScore !== null && l.leadPriority === 'HOT').length;
  const warmCount = leads.filter((l) => l.leadScore !== null && l.leadPriority === 'WARM').length;
  const coldCount = leads.filter((l) => l.leadScore !== null && l.leadPriority === 'COLD').length;
  const pendingCount = leads.filter((l) => l.leadScore === null).length;

  // Filter while strictly preserving the server-provided ranking order
  const filteredLeads = leads.filter((lead) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return lead.leadScore === null;
    return lead.leadScore !== null && lead.leadPriority === filter;
  });

  const getPriorityBadge = (lead: LeadRecord) => {
    if (lead.leadScore !== null) {
      const pri = lead.leadPriority || 'COLD';
      const badgeStyle =
        pri === 'HOT'
          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          : pri === 'WARM'
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          : 'bg-sky-500/10 text-sky-400 border-sky-500/30';

      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border ${badgeStyle}`}>
          <span>{lead.leadScore}/100</span>
          <span>&bull;</span>
          <span>{pri}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-zinc-800/80 text-amber-400 border border-amber-900/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Presentation-Level Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {/* All */}
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'ALL'
                ? 'bg-zinc-100 text-zinc-950 font-semibold'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <span>All Leads</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === 'ALL' ? 'bg-zinc-300 text-zinc-900' : 'bg-zinc-800 text-zinc-400'}`}>
              {totalCount}
            </span>
          </button>

          {/* HOT */}
          <button
            type="button"
            onClick={() => setFilter('HOT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'HOT'
                ? 'bg-rose-500 text-white font-semibold shadow-sm'
                : 'bg-zinc-900/80 text-rose-400 hover:bg-zinc-800 border border-rose-950/60'
            }`}
          >
            <span>HOT</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === 'HOT' ? 'bg-rose-700 text-white' : 'bg-rose-950 text-rose-400'}`}>
              {hotCount}
            </span>
          </button>

          {/* WARM */}
          <button
            type="button"
            onClick={() => setFilter('WARM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'WARM'
                ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
                : 'bg-zinc-900/80 text-amber-400 hover:bg-zinc-800 border border-amber-950/60'
            }`}
          >
            <span>WARM</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === 'WARM' ? 'bg-amber-700 text-white' : 'bg-amber-950 text-amber-400'}`}>
              {warmCount}
            </span>
          </button>

          {/* COLD */}
          <button
            type="button"
            onClick={() => setFilter('COLD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'COLD'
                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                : 'bg-zinc-900/80 text-sky-400 hover:bg-zinc-800 border border-sky-950/60'
            }`}
          >
            <span>COLD</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === 'COLD' ? 'bg-sky-700 text-white' : 'bg-sky-950 text-sky-400'}`}>
              {coldCount}
            </span>
          </button>

          {/* Pending Analysis */}
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'PENDING'
                ? 'bg-zinc-800 text-amber-400 border border-amber-500/40 font-semibold'
                : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <span>Pending Analysis</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === 'PENDING' ? 'bg-zinc-900 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
              {pendingCount}
            </span>
          </button>
        </div>

        <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
          Showing {filteredLeads.length} of {totalCount}
        </span>
      </div>

      {/* Filtered Empty State */}
      {filteredLeads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center space-y-3">
          <p className="text-sm text-zinc-400">
            {pendingCount === totalCount && filter !== 'PENDING'
              ? 'No analyzed leads yet. Analyze a lead to build your priority queue.'
              : `No leads currently match the "${filter}" priority filter.`}
          </p>
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className="text-xs font-medium text-emerald-400 hover:underline"
          >
            Reset filter to show all leads &rarr;
          </button>
        </div>
      ) : (
        /* Priority Queue Table */
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/70 text-zinc-400 uppercase tracking-wider font-semibold">
                  <th scope="col" className="py-3 px-3 w-12 text-center">Rank</th>
                  <th scope="col" className="py-3 px-4">Priority &amp; Score</th>
                  <th scope="col" className="py-3 px-4">Customer</th>
                  <th scope="col" className="py-3 px-4">Property &amp; Intelligence</th>
                  <th scope="col" className="py-3 px-4">Budget</th>
                  <th scope="col" className="py-3 px-4">Timeline</th>
                  <th scope="col" className="py-3 px-4">AI Status</th>
                  <th scope="col" className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredLeads.map((lead, idx) => {
                  const formattedDate = new Date(lead.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  // Derive deterministic "Why this lead?" explanation for scored leads
                  let explanation: string | null = null;
                  if (lead.leadScore !== null) {
                    const whyInfo = getLeadExplanation({
                      intentLevel: lead.aiIntentLevel,
                      buyingTimeline: lead.buyingTimeline,
                      budgetInr: lead.budgetInr,
                      requirementClarity: lead.aiRequirementClarity,
                      engagementLevel: lead.aiEngagementLevel,
                    });
                    explanation = whyInfo.explanation;
                  }

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-zinc-800/30 transition-colors group align-top"
                    >
                      {/* Rank Index */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-zinc-500 whitespace-nowrap">
                        #{idx + 1}
                      </td>

                      {/* Priority & Score Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPriorityBadge(lead)}
                      </td>

                      {/* Customer Name & Location */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors block"
                        >
                          {lead.name}
                        </Link>
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate max-w-[150px]">{lead.location}</span>
                        </span>
                      </td>

                      {/* Property Requirement & "Why this lead?" */}
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="text-zinc-200 font-medium truncate" title={lead.propertyRequirement}>
                          {lead.propertyRequirement}
                        </p>
                        {explanation ? (
                          <div className="mt-1 text-[11px] text-zinc-400 leading-snug">
                            <span className="text-emerald-400/90 font-medium">Why: </span>
                            <span>{explanation}</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-zinc-500 italic">
                            Analysis pending &mdash; click Analyze to score lead
                          </div>
                        )}
                      </td>

                      {/* Budget */}
                      <td className="py-3.5 px-4 font-mono font-medium text-emerald-400 whitespace-nowrap">
                        {formatBudgetDisplay(lead.budgetInr)}
                      </td>

                      {/* Buying Timeline */}
                      <td className="py-3.5 px-4 text-zinc-300 whitespace-nowrap">
                        {getTimelineLabel(lead.buyingTimeline)}
                      </td>

                      {/* Analysis Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                        {lead.aiAnalysisStatus === 'COMPLETED' ? (
                          <span className="text-emerald-400">Completed</span>
                        ) : lead.aiAnalysisStatus === 'FAILED' ? (
                          <span className="text-rose-400">Failed</span>
                        ) : (
                          <span className="text-amber-400">Pending</span>
                        )}
                        <span className="text-zinc-600 block text-[10px] mt-0.5">{formattedDate}</span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
                        >
                          <span>Act</span>
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
