<template>
  <div v-if="sessionInfo" class="session-info-card bg-[var(--theme-bg-primary)] rounded-lg shadow-lg border border-[var(--theme-border-primary)] p-4 mobile:p-2">
    <div class="flex items-center justify-between mb-3 mobile:mb-2">
      <h3 class="text-sm font-semibold text-[var(--theme-text-primary)] mobile:text-xs">Session Info</h3>
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

    <!-- Session Start Time -->
    <div class="mt-3 mobile:mt-2 pt-3 mobile:pt-2 border-t border-[var(--theme-border-secondary)]">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide">Started</span>
        <span class="text-xs mobile:text-[10px] text-[var(--theme-text-secondary)]">
          {{ formatStartTime(sessionInfo.startTime) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HookEvent } from '../types';

const props = defineProps<{
  events: HookEvent[];
}>();

// Get the most recent session info from latest event
const sessionInfo = computed(() => {
  const latestEvent = props.events[props.events.length - 1];
  if (!latestEvent?.session) return null;
  return latestEvent.session;
});

// Get the most recent session stats (Tier 1)
const sessionStats = computed(() => {
  const latestEvent = props.events[props.events.length - 1];
  if (!latestEvent?.sessionStats) return null;
  return latestEvent.sessionStats;
});

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return '0.0';
  return minutes.toFixed(1);
}

function formatStartTime(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return date.toLocaleTimeString();
    }
  } catch {
    return '';
  }
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
