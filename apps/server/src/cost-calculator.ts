/**
 * Cost Calculator for Claude API Usage
 * Pricing as of December 2024
 */

export interface ModelPricing {
  input: number;  // Cost per million tokens
  output: number; // Cost per million tokens
}

// Claude API Pricing (USD per million tokens)
export const CLAUDE_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Sonnet (December 2024)
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },  // Sonnet 4.5

  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },  // Haiku 4.5

  // Claude 3 Opus
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },

  // Claude 3 Sonnet (older)
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },

  // Claude 3 Haiku (older)
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },

  // Default for unknown models (use Sonnet pricing)
  'default': { input: 3.00, output: 15.00 }
};

/**
 * Calculate cost in USD for Claude API usage
 * @param modelName - Claude model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  modelName: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): number | undefined {
  // Return undefined if we don't have token counts
  if (inputTokens === undefined || outputTokens === undefined) {
    return undefined;
  }

  // Get pricing for this model (fallback to default if unknown)
  const pricing = modelName && CLAUDE_PRICING[modelName]
    ? CLAUDE_PRICING[modelName]
    : CLAUDE_PRICING['default'];

  // Calculate cost (pricing is per million tokens)
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Format cost as human-readable string
 * @param costUsd - Cost in USD
 * @returns Formatted string (e.g., "$0.0025" or "$2.50")
 */
export function formatCost(costUsd: number | undefined): string {
  if (costUsd === undefined || costUsd === null) {
    return '$0.00';
  }

  if (costUsd < 0.01) {
    // For very small costs, show more decimal places
    return `$${costUsd.toFixed(4)}`;
  } else if (costUsd < 1) {
    return `$${costUsd.toFixed(3)}`;
  } else {
    return `$${costUsd.toFixed(2)}`;
  }
}

/**
 * Extract token counts from event payload
 * @param payload - Event payload that might contain token usage
 * @returns Token counts or undefined
 */
export function extractTokensFromPayload(payload: Record<string, any>): {
  input_tokens?: number;
  output_tokens?: number;
} {
  // Check various possible locations for token data

  // Direct in payload
  if (payload.input_tokens !== undefined && payload.output_tokens !== undefined) {
    return {
      input_tokens: payload.input_tokens,
      output_tokens: payload.output_tokens
    };
  }

  // In usage object
  if (payload.usage) {
    return {
      input_tokens: payload.usage.input_tokens,
      output_tokens: payload.usage.output_tokens
    };
  }

  // In message.usage (for chat transcript events)
  if (payload.message?.usage) {
    return {
      input_tokens: payload.message.usage.input_tokens,
      output_tokens: payload.message.usage.output_tokens
    };
  }

  // In result.usage
  if (payload.result?.usage) {
    return {
      input_tokens: payload.result.usage.input_tokens,
      output_tokens: payload.result.usage.output_tokens
    };
  }

  return {};
}
