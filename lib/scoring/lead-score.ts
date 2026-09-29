export type IntentLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type EngagementLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RequirementClarity = 'CLEAR' | 'PARTIAL' | 'UNCLEAR';
export type LeadPriority = 'HOT' | 'WARM' | 'COLD';

export interface ScoringInput {
  intentLevel: IntentLevel | string | null | undefined;
  buyingTimeline: string | null | undefined;
  budgetInr: number | null | undefined;
  requirementClarity: RequirementClarity | string | null | undefined;
  engagementLevel: EngagementLevel | string | null | undefined;
}

export interface ScoreComponent {
  label: string;
  points: number;
  max: number;
}

export interface ScoreBreakdown {
  intent: ScoreComponent;
  timeline: ScoreComponent;
  budget: ScoreComponent;
  requirements: ScoreComponent;
  engagement: ScoreComponent;
  total: number;
}

export interface ScoreResult {
  score: number;
  priority: LeadPriority;
  breakdown: ScoreBreakdown;
  explanation: string;
  reasons: string[];
}

/**
 * Calculates deterministic lead score, priority, breakdown, and "Why this lead?" explanation.
 * Strictly deterministic - no network or AI calls.
 */
export function calculateLeadScore(input: ScoringInput): ScoreResult {
  // 1. Intent Points (+30 max)
  let intentPoints = 10;
  let intentLabel = 'Low (+10)';
  if (input.intentLevel === 'HIGH') {
    intentPoints = 30;
    intentLabel = 'High (+30)';
  } else if (input.intentLevel === 'MEDIUM') {
    intentPoints = 20;
    intentLabel = 'Medium (+20)';
  } else {
    intentPoints = 10;
    intentLabel = 'Low (+10)';
  }

  // 2. Buying Timeline Points (+25 max)
  let timelinePoints = 5;
  let timelineLabel = 'Exploring (+5)';
  if (input.buyingTimeline === '0-3 months') {
    timelinePoints = 25;
    timelineLabel = '0–3 months (+25)';
  } else if (input.buyingTimeline === '3-6 months') {
    timelinePoints = 15;
    timelineLabel = '3–6 months (+15)';
  } else if (input.buyingTimeline === '6-12 months') {
    timelinePoints = 10;
    timelineLabel = '6–12 months (+10)';
  } else {
    timelinePoints = 5;
    timelineLabel = 'Exploring (+5)';
  }

  // 3. Budget Points (+15 max)
  // Phase 2 requires a valid positive budget at intake; contributes constant +15
  let budgetPoints = 0;
  let budgetLabel = 'Missing / Invalid (+0)';
  if (typeof input.budgetInr === 'number' && Number.isFinite(input.budgetInr) && input.budgetInr > 0) {
    budgetPoints = 15;
    budgetLabel = 'Valid (+15)';
  }

  // 4. Requirement Clarity Points (+15 max)
  let reqPoints = 5;
  let reqLabel = 'Unclear (+5)';
  if (input.requirementClarity === 'CLEAR') {
    reqPoints = 15;
    reqLabel = 'Clear (+15)';
  } else if (input.requirementClarity === 'PARTIAL') {
    reqPoints = 10;
    reqLabel = 'Partial (+10)';
  } else {
    reqPoints = 5;
    reqLabel = 'Unclear (+5)';
  }

  // 5. Engagement Points (+15 max)
  let engagementPoints = 5;
  let engagementLabel = 'Low (+5)';
  if (input.engagementLevel === 'HIGH') {
    engagementPoints = 15;
    engagementLabel = 'High (+15)';
  } else if (input.engagementLevel === 'MEDIUM') {
    engagementPoints = 10;
    engagementLabel = 'Medium (+10)';
  } else {
    engagementPoints = 5;
    engagementLabel = 'Low (+5)';
  }

  const total = intentPoints + timelinePoints + budgetPoints + reqPoints + engagementPoints;

  // Priority thresholds:
  // 75-100 = HOT
  // 50-74  = WARM
  // 25-49  = COLD
  let priority: LeadPriority = 'COLD';
  if (total >= 75) {
    priority = 'HOT';
  } else if (total >= 50) {
    priority = 'WARM';
  } else {
    priority = 'COLD';
  }

  // Phase 4 "Why this lead?" deterministic explanation
  // Order: Intent, Budget, Requirement Clarity, Engagement, Timeline
  const intentPhrase = input.intentLevel === 'HIGH' ? 'High intent' : input.intentLevel === 'MEDIUM' ? 'Medium intent' : 'Low intent';
  const budgetPhrase = budgetPoints > 0 ? 'valid budget' : 'missing or invalid budget';
  const reqPhrase = input.requirementClarity === 'CLEAR' ? 'clear requirements' : input.requirementClarity === 'PARTIAL' ? 'partial requirement clarity' : 'unclear requirements';
  const engPhrase = input.engagementLevel === 'HIGH' ? 'high engagement' : input.engagementLevel === 'MEDIUM' ? 'medium engagement' : 'low engagement';
  const timelinePhrase = input.buyingTimeline === '0-3 months' ? '0–3 month timeline' : input.buyingTimeline === '3-6 months' ? '3–6 month timeline' : input.buyingTimeline === '6-12 months' ? '6–12 month timeline' : 'exploring timeline';

  const explanation = `${total}/100 ${priority} — ${intentPhrase}, ${budgetPhrase}, ${reqPhrase}, ${engPhrase}, ${timelinePhrase}.`;

  const reasons = [
    intentPhrase,
    budgetPhrase.charAt(0).toUpperCase() + budgetPhrase.slice(1),
    reqPhrase.charAt(0).toUpperCase() + reqPhrase.slice(1),
    engPhrase.charAt(0).toUpperCase() + engPhrase.slice(1),
    timelinePhrase.charAt(0).toUpperCase() + timelinePhrase.slice(1),
  ];

  return {
    score: total,
    priority,
    breakdown: {
      intent: { label: intentLabel, points: intentPoints, max: 30 },
      timeline: { label: timelineLabel, points: timelinePoints, max: 25 },
      budget: { label: budgetLabel, points: budgetPoints, max: 15 },
      requirements: { label: reqLabel, points: reqPoints, max: 15 },
      engagement: { label: engagementLabel, points: engagementPoints, max: 15 },
      total,
    },
    explanation,
    reasons,
  };
}

/**
 * Reusable helper to obtain "Why this lead?" explanation without repeating scoring logic.
 */
export function getLeadExplanation(input: ScoringInput): { explanation: string; reasons: string[] } {
  const result = calculateLeadScore(input);
  return {
    explanation: result.explanation,
    reasons: result.reasons,
  };
}
