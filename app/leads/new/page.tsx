import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

export const metadata = {
  title: 'New Lead Intake — LeadPilot AI',
  description: 'Intake and persist an inbound real estate sales lead into the database.',
};

export default function NewLeadPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors"
            >
              <span>&larr;</span>
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="font-semibold text-sm tracking-tight text-white">Lead Intake</span>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            Phase 2: Raw Lead Persistence
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-2">
              <span>Inbound Sales Record</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Record New Real Estate Lead
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Capture verified buyer criteria into your PostgreSQL database. AI prioritization and scoring will analyze this record in Phase 3.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-sm">
            <LeadForm />
          </div>
        </div>
      </main>
    </div>
  );
}
