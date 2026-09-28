export default function PhaseRoadmap() {
  const roadmapItems = [
    {
      title: 'Phase 1: Foundation & Infrastructure',
      status: 'completed',
      badge: 'Verified ✓',
      items: [
        'Next.js 16 + React 19 + TypeScript',
        'PostgreSQL + Prisma ORM integration',
        'Live system health verification (/api/health)',
        'Vercel deployment readiness & env isolation',
      ],
    },
    {
      title: 'Phase 2: Lead Domain & Data Store',
      status: 'active',
      badge: 'Current Phase',
      items: [
        'PostgreSQL Lead model & migration history',
        'Shared Zod validation (intake & API routes)',
        'Lead intake form with live INR budget preview',
        'Scannable dashboard queue & lead detail view',
      ],
    },
    {
      title: 'Phase 3: AI Prioritization & Intelligence',
      status: 'upcoming',
      badge: 'Planned',
      items: [
        'Explainable AI lead scoring engine',
        'Urgency & buyer readiness classification',
        'Dynamic priority queue for sales workflows',
      ],
    },
    {
      title: 'Phase 4: Grounded Sales Assistant & Follow-Up',
      status: 'upcoming',
      badge: 'Planned',
      items: [
        'Grounded conversational AI sales copilot',
        'Smart follow-up action plan & messaging',
        'Deal outcome tracking & feedback loop',
      ],
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Implementation Roadmap
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Planned architecture progression for LeadPilot AI
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
          Strict Phase Isolation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {roadmapItems.map((phase) => (
          <div
            key={phase.title}
            className={`p-4 rounded-lg border ${
              phase.status === 'active'
                ? 'bg-zinc-950/80 border-emerald-800/40'
                : phase.status === 'completed'
                ? 'bg-zinc-950/60 border-zinc-700/50'
                : 'bg-zinc-950/40 border-zinc-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-medium text-zinc-200">{phase.title}</h3>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                  phase.status === 'active'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                    : phase.status === 'completed'
                    ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50'
                }`}
              >
                {phase.badge}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-zinc-400">
              {phase.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                      phase.status === 'active'
                        ? 'bg-emerald-400'
                        : phase.status === 'completed'
                        ? 'bg-zinc-400'
                        : 'bg-zinc-600'
                    }`}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
