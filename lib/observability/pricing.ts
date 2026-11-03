/**
 * LeadPilot AI — Model Pricing and Cost Intelligence
 *
 * Configurable pricing rates per million tokens (USD).
 * Note: Costs are estimates based on published provider rates and may differ
 * from exact invoice billing due to prompt caching, tiered discounting, or minimum billable units.
 */

export interface ModelPricing {
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  currency: 'USD';
}

export const KNOWN_MODEL_PRICING: Record<string, Omit<ModelPricing, 'model'>> = {
  'gemini-3.5-flash-lite': {
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    currency: 'USD',
  },
  'gemini-2.5-flash-lite': {
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    currency: 'USD',
  },
  'gemini-1.5-flash': {
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    currency: 'USD',
  },
  'gemini-1.5-flash-8b': {
    inputPricePerMillion: 0.0375,
    outputPricePerMillion: 0.15,
    currency: 'USD',
  },
  'gemini-1.5-pro': {
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    currency: 'USD',
  },
};

export const DEFAULT_FALLBACK_PRICING: Omit<ModelPricing, 'model'> = {
  inputPricePerMillion: 0.075,
  outputPricePerMillion: 0.30,
  currency: 'USD',
};

export interface CostEstimate {
  model: string;
  isKnownModel: boolean;
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  estimatedCostUsd: number;
  pricing: ModelPricing;
  disclaimer: string;
}

/**
 * Resolves pricing configuration for a given model identifier.
 */
export function getModelPricing(model: string): { pricing: ModelPricing; isKnownModel: boolean } {
  const normalized = (model || '').toLowerCase().trim();
  const known = KNOWN_MODEL_PRICING[normalized];

  if (known) {
    return {
      pricing: { model, ...known },
      isKnownModel: true,
    };
  }

  return {
    pricing: { model: model || 'unknown', ...DEFAULT_FALLBACK_PRICING },
    isKnownModel: false,
  };
}

/**
 * Calculates estimated AI cost for an execution given model and token counts.
 * Safely handles missing/null token metadata and unrecognized models.
 */
export function calculateAiCost(
  model: string,
  promptTokens?: number | null,
  responseTokens?: number | null
): CostEstimate {
  const { pricing, isKnownModel } = getModelPricing(model);

  const safePromptTokens = Math.max(0, promptTokens ?? 0);
  const safeResponseTokens = Math.max(0, responseTokens ?? 0);
  const totalTokens = safePromptTokens + safeResponseTokens;

  const inputCostUsd = (safePromptTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCostUsd = (safeResponseTokens / 1_000_000) * pricing.outputPricePerMillion;
  const estimatedCostUsd = Number((inputCostUsd + outputCostUsd).toFixed(8));

  return {
    model: pricing.model,
    isKnownModel,
    promptTokens: safePromptTokens,
    responseTokens: safeResponseTokens,
    totalTokens,
    inputCostUsd: Number(inputCostUsd.toFixed(8)),
    outputCostUsd: Number(outputCostUsd.toFixed(8)),
    estimatedCostUsd,
    pricing,
    disclaimer:
      'Estimated cost based on published model token pricing. Actual Google Cloud / Gemini billing may vary.',
  };
}

