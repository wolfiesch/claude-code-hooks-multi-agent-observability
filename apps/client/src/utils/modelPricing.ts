/**
 * Claude Model Pricing
 *
 * Accurate pricing for all Claude models as of December 2024.
 * Prices are per million tokens (MTok).
 *
 * Source: https://www.anthropic.com/api#pricing
 */

export interface ModelPricing {
  input: number;  // $ per MTok
  output: number; // $ per MTok
  displayName: string;
  family: 'opus' | 'sonnet' | 'haiku';
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Sonnet (Latest)
  'claude-sonnet-4-5-20250929': {
    input: 3.00,
    output: 15.00,
    displayName: 'Claude 3.5 Sonnet (4.5)',
    family: 'sonnet'
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.00,
    output: 15.00,
    displayName: 'Claude 3.5 Sonnet (Oct 2024)',
    family: 'sonnet'
  },
  'claude-3-5-sonnet-20240620': {
    input: 3.00,
    output: 15.00,
    displayName: 'Claude 3.5 Sonnet (Jun 2024)',
    family: 'sonnet'
  },

  // Claude 3 Opus
  'claude-3-opus-20240229': {
    input: 15.00,
    output: 75.00,
    displayName: 'Claude 3 Opus',
    family: 'opus'
  },

  // Claude 3 Sonnet
  'claude-3-sonnet-20240229': {
    input: 3.00,
    output: 15.00,
    displayName: 'Claude 3 Sonnet',
    family: 'sonnet'
  },

  // Claude 3 Haiku
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    displayName: 'Claude 3 Haiku',
    family: 'haiku'
  },

  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
    displayName: 'Claude 3.5 Haiku',
    family: 'haiku'
  },

  // Legacy models (Claude 2)
  'claude-2.1': {
    input: 8.00,
    output: 24.00,
    displayName: 'Claude 2.1',
    family: 'sonnet' // Closest equivalent
  },
  'claude-2.0': {
    input: 8.00,
    output: 24.00,
    displayName: 'Claude 2.0',
    family: 'sonnet'
  },

  // Instant models
  'claude-instant-1.2': {
    input: 0.80,
    output: 2.40,
    displayName: 'Claude Instant 1.2',
    family: 'haiku' // Closest equivalent
  },
};

// Fallback pricing for unknown models (conservative estimate using Sonnet pricing)
export const FALLBACK_PRICING: ModelPricing = {
  input: 3.00,
  output: 15.00,
  displayName: 'Unknown Model',
  family: 'sonnet'
};

/**
 * Get pricing for a model, with fallback for unknown models
 */
export function getModelPricing(modelName: string | undefined): ModelPricing {
  if (!modelName) {
    return FALLBACK_PRICING;
  }

  // Try exact match first
  if (MODEL_PRICING[modelName]) {
    return MODEL_PRICING[modelName];
  }

  // Try partial match (handles versioned model names)
  const normalizedName = modelName.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return pricing;
    }
  }

  // Try to infer from model family keywords
  if (normalizedName.includes('opus')) {
    return MODEL_PRICING['claude-3-opus-20240229'];
  }
  if (normalizedName.includes('haiku')) {
    return MODEL_PRICING['claude-3-5-haiku-20241022'];
  }
  if (normalizedName.includes('sonnet')) {
    return MODEL_PRICING['claude-sonnet-4-5-20250929'];
  }

  // Fallback
  return FALLBACK_PRICING;
}

/**
 * Calculate cost from tokens and model
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelName: string | undefined
): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pricing: ModelPricing;
  isEstimated: boolean;
} {
  const pricing = getModelPricing(modelName);
  const isEstimated = !modelName || !MODEL_PRICING[modelName];

  // Calculate costs (prices are per MTok, so divide by 1,000,000)
  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  const totalCost = inputCost + outputCost;

  return {
    inputCost,
    outputCost,
    totalCost,
    pricing,
    isEstimated
  };
}

/**
 * Format model name for display
 */
export function formatModelName(modelName: string | undefined): string {
  if (!modelName) {
    return 'Unknown';
  }

  const pricing = getModelPricing(modelName);
  return pricing.displayName;
}
