<template>
  <div class="flex items-center gap-3 text-sm text-[var(--theme-text-secondary)]">
    <template v-if="indicators.length">
      <div
        v-for="indicator in indicators"
        :key="indicator.type"
        class="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)]"
        :title="indicator.label"
      >
        <span class="text-base">{{ indicator.icon }}</span>
        <span class="font-semibold">{{ indicator.count }}</span>
      </div>
    </template>
    <span v-else class="text-xs text-[var(--theme-text-tertiary)]">No critical events</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CriticalEventSummary } from '../types/history';

const props = withDefaults(defineProps<{
  summary?: CriticalEventSummary[];
}>(), {
  summary: () => []
});

const iconMap: Record<CriticalEventSummary['type'], { icon: string; label: string }> = {
  error: { icon: '🔴', label: 'Errors' },
  hitl: { icon: '🟡', label: 'Human-in-the-loop' },
  timeout: { icon: '⏱️', label: 'Timeouts' },
  high_cost: { icon: '💰', label: 'High cost' },
  long_tool: { icon: '🛠️', label: 'Long-running tools' }
};

const indicators = computed(() => {
  return (props.summary || [])
    .filter(item => ['error', 'hitl', 'high_cost'].includes(item.type) && item.count > 0)
    .map(item => ({
      type: item.type,
      count: item.count,
      icon: iconMap[item.type].icon,
      label: iconMap[item.type].label
    }));
});
</script>
