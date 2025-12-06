<template>
  <div class="flex-1 flex flex-col gap-3">
    <div class="flex items-center justify-between text-sm text-[var(--theme-text-tertiary)] px-1">
      <span>Sessions</span>
      <span v-if="totalCount !== undefined" class="text-[var(--theme-text-secondary)] font-medium">
        {{ sessions.length }} / {{ totalCount }} loaded
      </span>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-[var(--theme-text-secondary)]">
      Loading sessions...
    </div>

    <div v-else-if="!sessions.length" class="flex-1 flex items-center justify-center text-[var(--theme-text-tertiary)]">
      No sessions found for this range.
    </div>

    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-1"
    >
      <SessionCard
        v-for="session in sessions"
        :key="session.session_id"
        :session="session"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import SessionCard from './SessionCard.vue';
import type { SessionSummary } from '../types/history';

const props = withDefaults(defineProps<{
  sessions: SessionSummary[];
  totalCount?: number;
  loading?: boolean;
}>(), {
  sessions: () => [],
  loading: false
});

const emit = defineEmits<{
  select: [session: SessionSummary];
}>();
</script>
