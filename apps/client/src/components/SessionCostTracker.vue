<template>
  <div class="bg-[var(--theme-bg-primary)] rounded-lg border border-[var(--theme-border-primary)] p-4 mobile:p-3 shadow-lg">
    <div class="flex items-center justify-between mb-3 mobile:mb-2">
      <h3 class="text-sm font-semibold text-[var(--theme-text-primary)] flex items-center gap-2">
        <span class="text-lg">💰</span>
        Session Cost
      </h3>
      <div class="flex items-center gap-1.5">
        <span v-if="isEstimated" class="text-xs px-2 py-0.5 bg-amber-500 text-white rounded-full" title="Cost calculated using estimated pricing (model unknown)">
          ~Est.
        </span>
        <span v-if="modelName" class="text-xs px-2 py-0.5 bg-[var(--theme-primary)] text-white rounded-full">
          {{ modelName }}
        </span>
      </div>
    </div>

    <div v-if="hasData" class="space-y-3">
      <!-- Total Cost Display -->
      <div class="text-center py-3 bg-[var(--theme-bg-secondary)] rounded-lg border border-[var(--theme-border-secondary)]">
        <div class="text-3xl mobile:text-2xl font-bold text-[var(--theme-primary)]">
          ${{ formatCost(totalCost) }}
        </div>
        <div class="text-xs text-[var(--theme-text-secondary)] mt-1">
          Total Session Cost
        </div>
      </div>

      <!-- Token Metrics -->
      <div class="grid grid-cols-2 gap-2 mobile:gap-1.5">
        <!-- Input Tokens -->
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-3 mobile:p-2 border border-[var(--theme-border-secondary)]">
          <div class="text-xs text-[var(--theme-text-secondary)] mb-1">Input Tokens</div>
          <div class="text-lg mobile:text-base font-semibold text-[var(--theme-text-primary)]">
            {{ formatNumber(totalInputTokens) }}
          </div>
          <div class="text-xs text-[var(--theme-text-secondary)] mt-0.5">
            ${{ formatCost(inputCost) }}
          </div>
        </div>

        <!-- Output Tokens -->
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-3 mobile:p-2 border border-[var(--theme-border-secondary)]">
          <div class="text-xs text-[var(--theme-text-secondary)] mb-1">Output Tokens</div>
          <div class="text-lg mobile:text-base font-semibold text-[var(--theme-text-primary)]">
            {{ formatNumber(totalOutputTokens) }}
          </div>
          <div class="text-xs text-[var(--theme-text-secondary)] mt-0.5">
            ${{ formatCost(outputCost) }}
          </div>
        </div>
      </div>

      <!-- Efficiency Metrics -->
      <div class="grid grid-cols-3 gap-2 mobile:gap-1.5 text-center">
        <!-- Avg Cost Per Tool -->
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-2 mobile:p-1.5 border border-[var(--theme-border-secondary)]">
          <div class="text-xs text-[var(--theme-text-secondary)] mb-0.5">$/Tool</div>
          <div class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
            ${{ formatCost(avgCostPerTool) }}
          </div>
        </div>

        <!-- Token Efficiency -->
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-2 mobile:p-1.5 border border-[var(--theme-border-secondary)]">
          <div class="text-xs text-[var(--theme-text-secondary)] mb-0.5">Tok/Tool</div>
          <div class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
            {{ formatNumber(avgTokensPerTool) }}
          </div>
        </div>

        <!-- Tool Count -->
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-2 mobile:p-1.5 border border-[var(--theme-border-secondary)]">
          <div class="text-xs text-[var(--theme-text-secondary)] mb-0.5">Tools</div>
          <div class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
            {{ toolCount }}
          </div>
        </div>
      </div>

      <!-- Token Ratio Bar -->
      <div class="space-y-1">
        <div class="text-xs text-[var(--theme-text-secondary)] flex justify-between">
          <span>Token Distribution</span>
          <span>{{ inputRatio }}% in / {{ outputRatio }}% out</span>
        </div>
        <div class="relative h-2 bg-[var(--theme-border-secondary)] rounded-full overflow-hidden">
          <div
            class="absolute inset-y-0 left-0 bg-blue-500 transition-all duration-500"
            :style="{ width: `${inputRatio}%` }"
          ></div>
          <div
            class="absolute inset-y-0 bg-green-500 transition-all duration-500"
            :style="{ left: `${inputRatio}%`, width: `${outputRatio}%` }"
          ></div>
        </div>
      </div>

      <!-- Cost Projection (if session is active) -->
      <div v-if="projectedHourlyCost > 0" class="text-xs text-[var(--theme-text-secondary)] text-center pt-2 border-t border-[var(--theme-border-secondary)]">
        Projected: ${{ formatCost(projectedHourlyCost) }}/hour
      </div>
    </div>

    <!-- No data state -->
    <div v-else class="text-center py-4 text-[var(--theme-text-secondary)] text-sm">
      <div class="text-3xl mb-2">📊</div>
      <div>No cost data available</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { calculateCost, formatModelName } from '../utils/modelPricing';

interface Event {
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  model_name?: string;
  timestamp?: number;
}

interface Props {
  events: Event[];
  sessionDuration?: number; // in seconds
}

const props = defineProps<Props>();

const hasData = computed(() => {
  return props.events.length > 0 && props.events.some(e => e.input_tokens || e.output_tokens || e.cost_usd);
});

const totalInputTokens = computed(() => {
  return props.events.reduce((sum, event) => sum + (event.input_tokens || 0), 0);
});

const totalOutputTokens = computed(() => {
  return props.events.reduce((sum, event) => sum + (event.output_tokens || 0), 0);
});

const toolCount = computed(() => {
  return props.events.filter(e => e.input_tokens || e.output_tokens).length;
});

const mostRecentModelName = computed(() => {
  // Get most recent model name
  const eventsWithModel = props.events.filter(e => e.model_name);
  if (eventsWithModel.length === 0) return undefined;
  return eventsWithModel[eventsWithModel.length - 1].model_name;
});

const modelName = computed(() => {
  return formatModelName(mostRecentModelName.value);
});

// Calculate accurate costs using actual Claude pricing
const costBreakdown = computed(() => {
  return calculateCost(
    totalInputTokens.value,
    totalOutputTokens.value,
    mostRecentModelName.value
  );
});

const totalCost = computed(() => costBreakdown.value.totalCost);
const inputCost = computed(() => costBreakdown.value.inputCost);
const outputCost = computed(() => costBreakdown.value.outputCost);
const isEstimated = computed(() => costBreakdown.value.isEstimated);

const avgCostPerTool = computed(() => {
  if (toolCount.value === 0) return 0;
  return totalCost.value / toolCount.value;
});

const avgTokensPerTool = computed(() => {
  if (toolCount.value === 0) return 0;
  return Math.round((totalInputTokens.value + totalOutputTokens.value) / toolCount.value);
});

const inputRatio = computed(() => {
  const total = totalInputTokens.value + totalOutputTokens.value;
  if (total === 0) return 0;
  return Math.round((totalInputTokens.value / total) * 100);
});

const outputRatio = computed(() => {
  return 100 - inputRatio.value;
});

const projectedHourlyCost = computed(() => {
  if (!props.sessionDuration || props.sessionDuration === 0) return 0;
  const hoursElapsed = props.sessionDuration / 3600;
  if (hoursElapsed === 0) return 0;
  return totalCost.value / hoursElapsed;
});

const formatCost = (cost: number) => {
  if (cost === 0) return '0.00';
  if (cost < 0.01) return cost.toFixed(4);
  if (cost < 1) return cost.toFixed(3);
  return cost.toFixed(2);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};
</script>
