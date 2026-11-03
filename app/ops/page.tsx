import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getOperationalMetrics } from '@/lib/observability/metrics';
import OpsDashboardClient from '@/components/OpsDashboardClient';
import UserNav from '@/components/UserNav';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Operational Intelligence & AI Observability — LeadPilot AI',
};

export default async function OpsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops');
  }

  // Initial 7-day metrics scoped strictly to authenticated user
  const initialReport = await getOperationalMetrics({
    userId: user.id,
    range: '7d',
  });

  return (
    <div className="min-h-screen bg-[#F1E4DC] text-zinc-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-8 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
            >
              <span>&larr;</span>
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="font-bold text-sm tracking-tight text-zinc-900">
              Operations &amp; AI Intelligence
            </span>
          </div>

          <div className="flex items-center gap-4">
            <UserNav user={user} />
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C84B45] hover:bg-[#B33F3A] text-xs font-bold text-white shadow-sm transition-all active:scale-95"
            >
              <span>+ Add Lead</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1536px] mx-auto w-full px-4 sm:px-8 md:px-12 py-8 space-y-8">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C84B45]/10 border border-[#C84B45]/20 text-xs font-bold tracking-wider uppercase text-[#C84B45]">
            <span>System Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
            AI Operations &amp; Quality Intelligence
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 font-medium">
            Real-time telemetry, token consumption, cost analysis, and execution troubleshooting.
          </p>
        </div>

        <OpsDashboardClient initialReport={initialReport} />
      </main>
    </div>
  );
}

