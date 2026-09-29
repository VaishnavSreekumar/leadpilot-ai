import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

export const metadata = {
  title: 'New Lead Intake — LeadPilot AI',
  description: 'Intake and persist an inbound real estate sales lead into the database.',
};

export default function NewLeadPage() {
  return (
    <div className="min-h-screen bg-[#F6F4F0] text-zinc-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-8 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
            >
              <span>&larr;</span>
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="font-bold text-sm tracking-tight text-zinc-900">Lead Intake</span>
          </div>

          <span className="text-xs font-mono font-semibold px-3.5 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-zinc-600">
            Intake Record
          </span>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 sm:px-8 md:px-12 py-10">
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-xs font-bold text-amber-800 mb-2">
              <span>Inbound Sales Intake</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900">
              Record New Real Estate Lead
            </h1>
            <p className="text-sm sm:text-base font-medium text-zinc-600 mt-1">
              Capture verified buyer criteria into your PostgreSQL database for AI prioritization and scoring.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-10 shadow-xs">
            <LeadForm />
          </div>
        </div>
      </main>
    </div>
  );
}
