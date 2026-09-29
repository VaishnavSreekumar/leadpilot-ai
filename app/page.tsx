import Link from 'next/link';
import { prisma } from '@/lib/db';
import LeadTable from '@/components/LeadTable';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const leads = await prisma.lead.findMany({
    orderBy: [
      { leadScore: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
  });

  return (
    <div className="min-h-screen bg-[#F1E4DC] text-zinc-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-8 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#C84B45]/10 border border-[#C84B45]/20 flex items-center justify-center shrink-0">
              <div className="h-3.5 w-3.5 rounded-full bg-[#C84B45]"></div>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-extrabold text-lg tracking-tight text-zinc-900">LeadPilot AI</span>
              <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-[#C84B45] font-mono">
                Sales Command Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-500 font-semibold hidden md:inline">
              Real Estate Sales Intelligence
            </span>
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C84B45] hover:bg-[#B33F3A] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <span>+ Add Lead</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1536px] mx-auto w-full px-4 sm:px-8 md:px-12 py-10 space-y-10">
        {/* Workspace Hero & Positioning */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-200/80">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C84B45]/10 border border-[#C84B45]/20 text-xs font-bold tracking-wider uppercase text-[#C84B45]">
              <span>Real Estate Lead Prioritization</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900 leading-none">
              Your leads. Prioritized.
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 font-medium leading-relaxed pt-1">
              Know who to call, why they matter, and what to say next.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="px-5 py-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs font-mono text-xs flex items-center gap-4">
              <span className="text-zinc-500 font-sans text-xs font-bold uppercase tracking-wider">Queue Total</span>
              <span className="text-zinc-900 font-extrabold text-lg font-mono">
                {leads.length} {leads.length === 1 ? 'Lead' : 'Leads'}
              </span>
            </div>
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#C84B45] hover:bg-[#B33F3A] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <span>+ Add Lead</span>
            </Link>
          </div>
        </section>

        {/* Primary Lead Queue Workspace */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#C84B45]">
                Sales Priority Queue
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                Ranked by canonical score &bull; High intent and urgent timelines first
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400 font-semibold hidden sm:inline">
              ORDER: Priority Score DESC &bull; Newest First
            </span>
          </div>
          <LeadTable leads={leads} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 py-8 mt-16 bg-white">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-8 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-medium">
          <p>LeadPilot AI &bull; Real Estate Sales Intelligence</p>
          <div className="flex items-center gap-4 font-mono text-[#C84B45] font-semibold text-[11px]">
            <span>Prioritize</span>
            <span>&bull;</span>
            <span>Understand</span>
            <span>&bull;</span>
            <span>Follow Up</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


