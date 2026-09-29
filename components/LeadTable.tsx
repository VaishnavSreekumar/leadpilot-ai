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
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-12 text-center space-y-4 shadow-xs">
        <div className="h-12 w-12 rounded-xl bg-[#C84B45]/10 border border-[#C84B45]/20 flex items-center justify-center mx-auto text-[#C84B45]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-zinc-900">No leads yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium">
            Add your first inbound real-estate lead to start building your prioritized queue.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C84B45] hover:bg-[#B33F3A] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <span>+ Add Lead</span>
          </Link>
        </div>
      </div>
    );
  }

  // Counts based strictly on canonical rule:
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
          ? 'bg-red-50 text-red-700 border-red-200'
          : pri === 'WARM'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${badgeStyle}`}>
          <span>{lead.leadScore}/100</span>
          <span>&bull;</span>
          <span>{pri}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-100 text-zinc-600 border border-zinc-200 font-semibold">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Presentation-Level Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* All */}
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filter === 'ALL'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-600 hover:text-zinc-900 border border-zinc-200/80'
            }`}
          >
            <span>All Leads</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${filter === 'ALL' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
              {totalCount}
            </span>
          </button>

          {/* HOT */}
          <button
            type="button"
            onClick={() => setFilter('HOT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filter === 'HOT'
                ? 'bg-[#C84B45] text-white shadow-xs'
                : 'bg-red-50/80 text-red-700 hover:bg-red-100 border border-red-200/80'
            }`}
          >
            <span>HOT</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${filter === 'HOT' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-800'}`}>
              {hotCount}
            </span>
          </button>

          {/* WARM */}
          <button
            type="button"
            onClick={() => setFilter('WARM')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filter === 'WARM'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50/80 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
            }`}
          >
            <span>WARM</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${filter === 'WARM' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {warmCount}
            </span>
          </button>

          {/* COLD */}
          <button
            type="button"
            onClick={() => setFilter('COLD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filter === 'COLD'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <span>COLD</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${filter === 'COLD' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'}`}>
              {coldCount}
            </span>
          </button>

          {/* Pending Analysis */}
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filter === 'PENDING'
                ? 'bg-zinc-800 text-amber-300 shadow-xs'
                : 'bg-white text-zinc-600 hover:text-zinc-900 border border-zinc-200/80'
            }`}
          >
            <span>Pending Analysis</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${filter === 'PENDING' ? 'bg-zinc-950 text-amber-300' : 'bg-zinc-100 text-zinc-600'}`}>
              {pendingCount}
            </span>
          </button>
        </div>

        <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
          Showing {filteredLeads.length} of {totalCount}
        </span>
      </div>

      {/* Filtered Empty State */}
      {filteredLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-600">
            {pendingCount === totalCount && filter !== 'PENDING'
              ? 'No analyzed leads yet. Analyze a lead to build your priority queue.'
              : `No leads currently match the "${filter}" priority filter.`}
          </p>
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className="text-xs font-bold text-[#C84B45] hover:underline"
          >
            Reset filter to show all leads &rarr;
          </button>
        </div>
      ) : (
        /* Priority Queue Table */
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-zinc-500 uppercase tracking-wider font-bold">
                  <th scope="col" className="py-3.5 px-4 w-12 text-center">Rank</th>
                  <th scope="col" className="py-3.5 px-4">Priority &amp; Score</th>
                  <th scope="col" className="py-3.5 px-4">Customer</th>
                  <th scope="col" className="py-3.5 px-4">Requirement &amp; Intelligence</th>
                  <th scope="col" className="py-3.5 px-4">Budget</th>
                  <th scope="col" className="py-3.5 px-4">Timeline</th>
                  <th scope="col" className="py-3.5 px-4">AI Status</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60">
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
                      className="hover:bg-zinc-50/80 transition-colors group align-top"
                    >
                      {/* Rank Index */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-zinc-400 whitespace-nowrap">
                        #{idx + 1}
                      </td>

                      {/* Priority & Score Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {getPriorityBadge(lead)}
                      </td>

                      {/* Customer Name & Location */}
                      <td className="py-4 px-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-bold text-zinc-900 hover:text-[#C84B45] transition-colors block text-sm"
                        >
                          {lead.name}
                        </Link>
                        <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
                          <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate max-w-[150px]">{lead.location}</span>
                        </span>
                      </td>

                      {/* Property Requirement & "Why this lead?" */}
                      <td className="py-4 px-4 max-w-md">
                        <p className="text-zinc-800 font-semibold truncate" title={lead.propertyRequirement}>
                          {lead.propertyRequirement}
                        </p>
                        {explanation ? (
                          <div className="mt-1 text-[11px] text-zinc-600 leading-snug font-medium">
                            <span className="text-[#C84B45] font-bold">Why: </span>
                            <span>{explanation}</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-zinc-400 italic font-medium">
                            Analysis pending &mdash; click Review Lead to analyze
                          </div>
                        )}
                      </td>

                      {/* Budget */}
                      <td className="py-4 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {formatBudgetDisplay(lead.budgetInr)}
                      </td>

                      {/* Buying Timeline */}
                      <td className="py-4 px-4 text-zinc-700 font-medium whitespace-nowrap">
                        {getTimelineLabel(lead.buyingTimeline)}
                      </td>

                      {/* Analysis Status */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px]">
                        {lead.aiAnalysisStatus === 'COMPLETED' ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Completed</span>
                        ) : lead.aiAnalysisStatus === 'FAILED' ? (
                          <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Failed</span>
                        ) : (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pending</span>
                        )}
                        <span className="text-zinc-400 block text-[10px] mt-1 font-mono">{formattedDate}</span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-[#C84B45] text-white text-xs font-bold transition-all shadow-2xs"
                        >
                          <span>Review Lead</span>
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
