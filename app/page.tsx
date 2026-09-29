import Link from 'next/link';
import { prisma } from '@/lib/db';
import SystemStatus from '@/components/SystemStatus';
import PhaseRoadmap from '@/components/PhaseRoadmap';
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded bg-emerald-400"></div>
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">LeadPilot AI</span>
            <span className="text-zinc-500 text-xs font-mono">v0.4.0</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Phase 4: Sales Priority Queue
            </span>
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <span>+ Add Lead</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Workspace Header & Action Bar */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-2">
              <span>Real Estate Sales Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Sales Priority Queue
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              &ldquo;Which lead should I act on next, why, and what should I say?&rdquo;
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs">
              <span className="text-zinc-500 mr-2">DATABASE TOTAL:</span>
              <span className="text-zinc-100 font-bold text-sm">
                {leads.length} {leads.length === 1 ? 'Lead' : 'Leads'}
              </span>
            </div>
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm shrink-0"
            >
              <span>+ Add Lead</span>
            </Link>
          </div>
        </section>

        {/* Primary Lead Queue Workspace */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Ranked Inbound Leads
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              Ranked by: Priority Score DESC (nulls last) &bull; Newest First
            </span>
          </div>
          <LeadTable leads={leads} />
        </section>

        {/* Phase Implementation Roadmap */}
        <section>
          <PhaseRoadmap />
        </section>

        {/* Secondary: Infrastructure & Health Monitoring */}
        <section className="space-y-3 pt-4 border-t border-zinc-800/60">
          <SystemStatus />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-6 mt-12 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>LeadPilot AI &bull; Internal Salesperson Tool &bull; Phase 2</p>
          <div className="flex items-center gap-4 font-mono">
            <span>Next.js 16</span>
            <span>&bull;</span>
            <span>Prisma 6</span>
            <span>&bull;</span>
            <span>PostgreSQL (Neon)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
