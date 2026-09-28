import Link from 'next/link';
import type { LeadRecord } from '@/types';
import { formatBudgetDisplay, getTimelineLabel } from '@/lib/validations/lead';

interface LeadTableProps {
  leads: LeadRecord[];
}

export default function LeadTable({ leads }: LeadTableProps) {
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

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/70 text-zinc-400 uppercase tracking-wider font-semibold">
              <th scope="col" className="py-3 px-4">Customer Name</th>
              <th scope="col" className="py-3 px-4">Location</th>
              <th scope="col" className="py-3 px-4">Property Requirement</th>
              <th scope="col" className="py-3 px-4">Budget</th>
              <th scope="col" className="py-3 px-4">Buying Timeline</th>
              <th scope="col" className="py-3 px-4">AI Status</th>
              <th scope="col" className="py-3 px-4">Intake Date</th>
              <th scope="col" className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {leads.map((lead) => {
              const formattedDate = new Date(lead.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <tr
                  key={lead.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-semibold text-zinc-100 whitespace-nowrap">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                    >
                      <span>{lead.name}</span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300 whitespace-nowrap">
                    {lead.location}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300 max-w-xs truncate" title={lead.propertyRequirement}>
                    {lead.propertyRequirement}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-emerald-400 whitespace-nowrap">
                    {formatBudgetDisplay(lead.budgetInr)}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300 whitespace-nowrap">
                    {getTimelineLabel(lead.buyingTimeline)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-amber-400 border border-amber-900/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                      AI analysis pending
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-500 whitespace-nowrap">
                    {formattedDate}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
                    >
                      <span>View</span>
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
  );
}
