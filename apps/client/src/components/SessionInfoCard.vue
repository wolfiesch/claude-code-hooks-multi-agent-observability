<template>
  <div v-if="sessionInfo" class="session-info-card bg-[var(--theme-bg-primary)] rounded-lg shadow-lg border border-[var(--theme-border-primary)] p-4 mobile:p-2">
    <div class="flex items-center justify-between mb-3 mobile:mb-2">
      <div class="flex items-center gap-2 mobile:gap-1">
        <h3 class="text-sm font-semibold text-[var(--theme-text-primary)] mobile:text-xs">Session Info</h3>
        <span
          v-if="selectedAgent"
          class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[var(--theme-primary-light)] text-[var(--theme-primary-dark)] border border-[var(--theme-primary)]"
          title="Inspecting this agent"
        >
          📌 {{ selectedAgent }}
        </span>
        <span
          v-else
          class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--theme-bg-secondary)] text-[var(--theme-text-tertiary)] border border-[var(--theme-border-secondary)]"
          title="Auto mode - showing latest from all agents"
        >
          AUTO
        </span>
      </div>
      <div class="flex items-center space-x-2 mobile:space-x-1">
        <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)]">
          {{ sessionInfo.workingDirectoryName }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mobile:gap-2">
      <!-- Model Badge -->
      <div class="flex flex-col">
        <span class="text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide mb-1">Model</span>
        <div class="flex items-center space-x-1">
          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[var(--theme-primary-light)] text-[var(--theme-primary-dark)] border border-[var(--theme-primary)]">
            {{ sessionInfo.modelShort || sessionInfo.model }}
          </span>
        </div>
      </div>

      <!-- Duration -->
      <div class="flex flex-col">
        <span class="text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide mb-1">Duration</span>
        <div class="flex items-center space-x-1">
          <span class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
            {{ formatDuration(sessionInfo.durationMinutes) }}
          </span>
          <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)]">min</span>
        </div>
      </div>

      <!-- Tool Count -->
      <div class="flex flex-col">
        <span class="text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide mb-1">Tools</span>
        <div class="flex items-center space-x-1">
          <span class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
            {{ sessionInfo.toolCount || 0 }}
          </span>
          <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)]">executed</span>
        </div>
      </div>

      <!-- Session Stats (Tier 1) -->
      <div v-if="sessionStats" class="flex flex-col">
        <span class="text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide mb-1">Files</span>
        <div class="flex items-center space-x-1">
          <span class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
            {{ sessionStats.filesRead + sessionStats.filesWritten + sessionStats.filesEdited }}
          </span>
          <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)]">touched</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HookEvent } from '../types';

const props = defineProps<{
  events: HookEvent[];
  selectedAgent?: string | null;
}>();

// Get the most recent session info by scanning backwards through events
const sessionInfo = computed(() => {
  if (props.events.length === 0) return null;

  // Scan backwards to find the most recent event with session data
  for (let i = props.events.length - 1; i >= 0; i--) {
    const event = props.events[i];
    if (event?.session) {
      return event.session;
    }
  }

  return null;
});

// Get the most recent session stats by scanning backwards through events
const sessionStats = computed(() => {
  if (props.events.length === 0) return null;

  // Scan backwards to find the most recent event with session stats
  for (let i = props.events.length - 1; i >= 0; i--) {
    const event = props.events[i];
    if (event?.sessionStats) {
      return event.sessionStats;
    }
  }

  return null;
});

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return '0.0';
  return minutes.toFixed(1);
}
</script>

<style scoped>
.session-info-card {
  min-width: 280px;
}

@media (max-width: 640px) {
  .session-info-card {
    min-width: unset;
  }
}
</style>
