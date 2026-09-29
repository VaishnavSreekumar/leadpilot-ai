'use client';

import { useState } from 'react';
import LeadAnalysisSection from '@/components/LeadAnalysisSection';
import SalesAssistant from '@/components/SalesAssistant';
import SmartFollowUp from '@/components/SmartFollowUp';

interface FollowUpData {
  recommendedAt: string | null;
  daysFromNow: number;
  reason: string;
  focusPoints: string[];
  suggestedMessage: string;
  generatedAt: string;
}

interface LeadWorkspaceProps {
  lead: {
    id: string;
    name: string;
    location: string;
    propertyRequirement: string;
    budgetInr: number;
    buyingTimeline: string;
    customerMessage: string;
    aiSummary: string | null;
    aiIntent: string | null;
    aiKeyRequirements: string[];
    aiObjections: string[];
    aiRecommendedNextAction: string | null;
    aiSuggestedResponse: string | null;
    aiSuggestedQuestions: string[];
    aiIntentLevel: string | null;
    aiEngagementLevel: string | null;
    aiRequirementClarity: string | null;
    aiAnalyzedAt: Date | string | null;
    aiAnalysisStatus: string | null;
    leadScore: number | null;
    leadPriority: string | null;
  };
  initialFollowUp?: FollowUpData | null;
}

export default function LeadAnalysisWorkspace({ lead: initialLead, initialFollowUp = null }: LeadWorkspaceProps) {
  const [lead, setLead] = useState(initialLead);

  const handleAnalysisComplete = (updatedData: Record<string, unknown>) => {
    setLead((prev) => ({
      ...prev,
      ...updatedData,
    }));
  };

  const isAnalyzed = lead.aiAnalysisStatus === 'COMPLETED';

  return (
    <div className="space-y-8">
      {/* Priority / Score / Why this lead? / AI Analysis / Recommended Action */}
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
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Sales Assistant & Smart Follow-Up Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Grounded Sales Assistant Workspace */}
        <section aria-label="Sales Assistant">
          <SalesAssistant
            leadId={lead.id}
            leadName={lead.name}
            leadPriority={lead.leadPriority}
            isAnalyzed={isAnalyzed}
            suggestedQuestions={lead.aiSuggestedQuestions ?? []}
          />
        </section>

        {/* Smart Follow-Up Workspace */}
        <section aria-label="Smart Follow-Up">
          <SmartFollowUp
            leadId={lead.id}
            leadName={lead.name}
            initialFollowUp={initialFollowUp}
          />
        </section>
      </div>
    </div>
  );
}
