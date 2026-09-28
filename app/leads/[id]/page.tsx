import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatBudgetDisplay, getTimelineLabel } from '@/lib/validations/lead';
import LeadAnalysisSection from '@/components/LeadAnalysisSection';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!lead) {
    return { title: 'Lead Not Found — LeadPilot AI' };
  }

  return {
    title: `${lead.name} — Lead Record | LeadPilot AI`,
  };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
  });

  if (!lead) {
    notFound();
  }

  const createdDate = new Date(lead.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const updatedDate = new Date(lead.updatedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors"
            >
              <span>&larr;</span>
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="font-semibold text-sm tracking-tight text-white truncate max-w-[200px] sm:max-w-xs">
              {lead.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-700/60 transition-colors"
            >
              <span>+ Add Another</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Lead Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                ID: {lead.id}
              </span>
              {lead.aiAnalysisStatus === 'COMPLETED' ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  AI Analyzed ({lead.leadScore ?? '--'}/100 &bull; {lead.leadPriority ?? 'COLD'})
                </span>
              ) : lead.aiAnalysisStatus === 'FAILED' ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/40">
                  AI Analysis Unavailable
                </span>
              ) : (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-900/40">
                  AI Analysis Pending
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {lead.name}
            </h1>
            <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{lead.location}</span>
            </p>
          </div>

          <div className="flex flex-col sm:items-end text-xs text-zinc-500 font-mono space-y-1">
            <span>Created: {createdDate}</span>
            <span>Updated: {updatedDate}</span>
          </div>
        </div>

        {/* Lead Core Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Budget */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Target Budget
            </span>
            <p className="text-lg font-bold text-zinc-100 font-mono">
              {formatBudgetDisplay(lead.budgetInr)}
            </p>
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              Raw INR: {lead.budgetInr.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Buying Timeline */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Buying Timeline
            </span>
            <p className="text-base font-semibold text-zinc-100">
              {getTimelineLabel(lead.buyingTimeline)}
            </p>
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              Key: {lead.buyingTimeline}
            </p>
          </div>

          {/* Property Requirement */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Property Requirement
            </span>
            <p className="text-sm font-medium text-zinc-200">
              {lead.propertyRequirement}
            </p>
          </div>
        </div>

        {/* Inbound Customer Message */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Inbound Customer Message / Conversation Notes
          </h2>
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {lead.customerMessage}
          </div>
        </div>

        {/* AI Analysis & Deterministic Scoring Section */}
        <LeadAnalysisSection
          leadId={lead.id}
          initialStatus={lead.aiAnalysisStatus}
          initialAiSummary={lead.aiSummary}
          initialAiIntent={lead.aiIntent}
          initialAiKeyRequirements={lead.aiKeyRequirements ?? []}
          initialAiObjections={lead.aiObjections ?? []}
          initialAiRecommendedNextAction={lead.aiRecommendedNextAction}
          initialAiSuggestedResponse={lead.aiSuggestedResponse}
          initialAiIntentLevel={lead.aiIntentLevel}
          initialAiEngagementLevel={lead.aiEngagementLevel}
          initialAiRequirementClarity={lead.aiRequirementClarity}
          initialLeadScore={lead.leadScore}
          initialLeadPriority={lead.leadPriority}
          initialAnalyzedAt={lead.aiAnalyzedAt}
          buyingTimeline={lead.buyingTimeline}
          budgetInr={lead.budgetInr}
        />
      </main>
    </div>
  );
}
