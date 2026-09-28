import { z } from 'zod';

export const BUYING_TIMELINES = [
  { value: '0-3 months', label: 'Within 0–3 months' },
  { value: '3-6 months', label: '3–6 months' },
  { value: '6-12 months', label: '6–12 months' },
  { value: 'exploring', label: 'Exploring / No fixed timeline' },
] as const;

export const BUYING_TIMELINE_VALUES = [
  '0-3 months',
  '3-6 months',
  '6-12 months',
  'exploring',
] as const;

export type BuyingTimeline = (typeof BUYING_TIMELINE_VALUES)[number];

export const MAX_BUDGET_INR = 2000000000; // ₹200 Cr (safe 32-bit integer limit)

export const leadInputSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  location: z
    .string({ required_error: 'Location is required' })
    .trim()
    .min(1, 'Location is required')
    .max(150, 'Location must be 150 characters or less'),
  propertyRequirement: z
    .string({ required_error: 'Property requirement is required' })
    .trim()
    .min(1, 'Property requirement is required')
    .max(300, 'Property requirement must be 300 characters or less'),
  budgetInr: z
    .number({
      required_error: 'Budget is required',
      invalid_type_error: 'Budget must be a valid number',
    })
    .int('Budget must be a whole integer in rupees')
    .positive('Budget must be greater than zero')
    .max(MAX_BUDGET_INR, 'Budget cannot exceed ₹200 Cr (2,000,000,000)'),
  buyingTimeline: z.enum(BUYING_TIMELINE_VALUES, {
    errorMap: () => ({ message: 'Please select a valid buying timeline' }),
  }),
  customerMessage: z
    .string({ required_error: 'Customer message is required' })
    .trim()
    .min(1, 'Customer message is required')
    .max(5000, 'Customer message must be 5,000 characters or less'),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

/**
 * Formats a budget number into an Indian Rupee string with Lakh/Crore shorthand preview.
 * Example: 12000000 -> "₹1,20,00,000 · 1.2 Cr"
 */
export function formatBudgetDisplay(inr: number): string {
  if (!Number.isFinite(inr) || inr <= 0) return '';

  const fullRupees = `₹${inr.toLocaleString('en-IN')}`;

  let shorthand = '';
  if (inr >= 10000000) {
    const cr = (inr / 10000000).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });
    shorthand = `${cr} Cr`;
  } else if (inr >= 100000) {
    const lakh = (inr / 100000).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });
    shorthand = `${lakh} L`;
  } else if (inr >= 1000) {
    const k = (inr / 1000).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });
    shorthand = `${k} K`;
  }

  return shorthand ? `${fullRupees} · ${shorthand}` : fullRupees;
}

/**
 * Returns human-readable label for a buying timeline stored value.
 */
export function getTimelineLabel(value: string): string {
  const match = BUYING_TIMELINES.find((t) => t.value === value);
  return match ? match.label : value;
}
