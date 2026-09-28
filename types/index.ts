export interface HealthCheckResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp?: string;
  message?: string;
}

export type { LeadInput, BuyingTimeline } from '@/lib/validations/lead';

export interface LeadRecord {
  id: string;
  name: string;
  location: string;
  propertyRequirement: string;
  budgetInr: number;
  buyingTimeline: string;
  customerMessage: string;
  createdAt: string | Date;
  updatedAt: string | Date;

  // Phase 3: AI Analysis & Scoring
  aiSummary?: string | null;
  aiIntent?: string | null;
  aiKeyRequirements?: string[];
  aiObjections?: string[];
  aiRecommendedNextAction?: string | null;
  aiSuggestedResponse?: string | null;
  aiIntentLevel?: string | null;
  aiEngagementLevel?: string | null;
  aiRequirementClarity?: string | null;
  aiAnalyzedAt?: string | Date | null;
  aiAnalysisStatus?: string | null;
  leadScore?: number | null;
  leadPriority?: string | null;
}

