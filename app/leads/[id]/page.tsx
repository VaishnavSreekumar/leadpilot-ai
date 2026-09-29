import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatBudgetDisplay, getTimelineLabel } from '@/lib/validations/lead';
import LeadAnalysisWorkspace from '@/components/LeadAnalysisWorkspace';
import { getFollowUpDays } from '@/lib/ai/follow-up';

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
            <span className="font-bold text-sm tracking-tight text-zinc-900 truncate max-w-[200px] sm:max-w-md">
              {lead.name}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-zinc-500 font-semibold hidden md:inline">
              Lead Record #{lead.id}
            </span>
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
        {/* Lead Identity Section */}
        <section aria-label="Lead Identity" className="bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[11px] font-mono font-semibold px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                  ID: {lead.id}
                </span>
                {lead.aiAnalysisStatus === 'COMPLETED' ? (
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    AI Analyzed ({lead.leadScore ?? '--'}/100 &bull; {lead.leadPriority ?? 'COLD'})
                  </span>
                ) : lead.aiAnalysisStatus === 'FAILED' ? (
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80">
                    AI Analysis Unavailable
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                    AI Analysis Pending
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900">
                {lead.name}
              </h1>
              <p className="text-sm font-semibold text-zinc-500 mt-1 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{lead.location}</span>
              </p>
            </div>

            <div className="flex flex-col sm:items-end text-xs text-zinc-400 font-mono space-y-1 font-medium">
              <span>Created: {createdDate}</span>
              <span>Updated: {updatedDate}</span>
            </div>
          </div>

          {/* Core Attributes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Target Budget
              </span>
              <p className="text-xl font-extrabold text-zinc-900 font-mono">
                {formatBudgetDisplay(lead.budgetInr)}
              </p>
              <p className="text-xs text-zinc-400 mt-1 font-mono font-medium">
                Raw: ₹{lead.budgetInr.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Buying Timeline
              </span>
              <p className="text-lg font-bold text-zinc-900">
                {getTimelineLabel(lead.buyingTimeline)}
              </p>
              <p className="text-xs text-zinc-400 mt-1 font-mono font-medium">
                Key: {lead.buyingTimeline}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Property Requirement
              </span>
              <p className="text-sm font-bold text-zinc-800 leading-snug">
                {lead.propertyRequirement}
              </p>
            </div>
          </div>

          {/* Inbound Customer Message */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              Inbound Customer Message / Conversation Notes
            </span>
            <div className="p-4 sm:p-5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed font-medium">
              {lead.customerMessage}
            </div>
          </div>
        </section>

        {/* Lead Analysis & Workspace Grid */}
        <LeadAnalysisWorkspace
          lead={lead}
          initialFollowUp={
            lead.followUpGeneratedAt && lead.followUpReason
              ? {
                  recommendedAt: lead.followUpRecommendedAt?.toISOString() ?? null,
                  daysFromNow: getFollowUpDays(lead.buyingTimeline, lead.leadPriority),
                  reason: lead.followUpReason,
                  focusPoints: lead.followUpFocusPoints ?? [],
                  suggestedMessage: lead.followUpMessage ?? '',
                  generatedAt: lead.followUpGeneratedAt.toISOString(),
                }
              : null
          }
        />
      </main>
    </div>
  );
}
