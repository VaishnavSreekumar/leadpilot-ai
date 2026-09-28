import SystemStatus from '@/components/SystemStatus';
import PhaseRoadmap from '@/components/PhaseRoadmap';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded bg-emerald-400"></div>
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">LeadPilot AI</span>
            <span className="text-zinc-500 text-xs font-mono">v0.1.0</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Phase 1: Foundation
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Shell */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 space-y-8">
        {/* Hero / Header Section */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400">
            <span>Real Estate Sales Prioritization</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            AI Sales Command Center
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl font-normal leading-relaxed">
            &ldquo;Know who to contact, why, and what to say.&rdquo;
          </p>
        </section>

        {/* Live System Infrastructure Health Check */}
        <section>
          <SystemStatus />
        </section>

        {/* Product Roadmap / Future Phases */}
        <section>
          <PhaseRoadmap />
        </section>

        {/* Architecture & Engineering Standards */}
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            System Architecture &amp; Data Pipeline
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
              <span className="text-zinc-500 block mb-1">01 / CLIENT</span>
              <span className="text-zinc-200 font-medium">Next.js 16 UI Shell</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
              <span className="text-zinc-500 block mb-1">02 / RUNTIME</span>
              <span className="text-zinc-200 font-medium">Server API &amp; Actions</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
              <span className="text-zinc-500 block mb-1">03 / ORM</span>
              <span className="text-zinc-200 font-medium">Prisma Singleton</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
              <span className="text-zinc-500 block mb-1">04 / STORAGE</span>
              <span className="text-zinc-200 font-medium">PostgreSQL Database</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-6 mt-12 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>LeadPilot AI &bull; Production Foundation &bull; Internal Salesperson Tool</p>
          <div className="flex items-center gap-4 font-mono">
            <span>Next.js 16</span>
            <span>&bull;</span>
            <span>Prisma 6</span>
            <span>&bull;</span>
            <span>PostgreSQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
