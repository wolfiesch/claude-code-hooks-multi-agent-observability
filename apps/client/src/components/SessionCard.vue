<template>
  <div
    class="p-4 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] shadow-md hover:border-[var(--theme-primary)] hover:shadow-lg transition-theme cursor-pointer flex flex-col gap-3"
    @click="emit('select', session)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <div class="text-sm font-semibold text-[var(--theme-text-primary)]">
          {{ agentId }}
        </div>
        <div class="text-xs text-[var(--theme-text-tertiary)]">
          {{ repoLabel }}
        </div>
        <div class="text-[11px] text-[var(--theme-text-quaternary)]">
          {{ startedAt }}
        </div>
      </div>
      <StatusBadge :status="session.status" />
    </div>

    <div class="grid grid-cols-2 gap-2 text-sm text-[var(--theme-text-secondary)]">
      <div class="flex flex-col rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] p-2">
        <span class="text-[10px] uppercase text-[var(--theme-text-tertiary)]">Duration</span>
        <span class="font-semibold text-[var(--theme-text-primary)]">{{ durationLabel }}</span>
      </div>
      <div class="flex flex-col rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] p-2">
        <span class="text-[10px] uppercase text-[var(--theme-text-tertiary)]">Events</span>
        <span class="font-semibold text-[var(--theme-text-primary)]">{{ session.event_count }}</span>
      </div>
    </div>

    <div class="pt-1 border-t border-dashed border-[var(--theme-border-secondary)]">
      <CriticalEventIndicators :summary="session.critical_events_summary" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CriticalEventIndicators from './CriticalEventIndicators.vue';
import StatusBadge from './StatusBadge.vue';
import type { SessionSummary } from '../types/history';

const props = defineProps<{
  session: SessionSummary;
}>();

const emit = defineEmits<{
  select: [session: SessionSummary];
}>();

const agentId = computed(() => {
  const truncated = props.session.session_id?.slice(0, 8) || '';
  return `${props.session.source_app}:${truncated}`;
});

const repoLabel = computed(() => props.session.repo_name || props.session.project_name || 'No repo linked');

const startedAt = computed(() => new Date(props.session.start_time).toLocaleString());

const durationLabel = computed(() => formatDuration(props.session.duration_ms ?? undefined));

function formatDuration(ms?: number): string {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
</script>
