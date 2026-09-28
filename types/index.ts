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
}
