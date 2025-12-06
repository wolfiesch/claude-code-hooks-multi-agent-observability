<template>
  <div class="flex flex-col h-full bg-[var(--theme-bg-secondary)]">
    <FilterBar
      :filters="filters"
      :filter-options="filterOptions"
      @filter-change="handleFilterChange"
    />

    <div class="flex-1 overflow-hidden p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between text-sm text-[var(--theme-text-secondary)]">
        <div class="flex items-center gap-2">
          <span class="text-[var(--theme-text-primary)] font-semibold">History</span>
          <span class="text-[var(--theme-text-tertiary)]">Latest sessions and critical events</span>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="isLoading" class="text-[var(--theme-text-tertiary)]">Refreshing...</span>
          <button
            class="px-3 py-2 rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] transition-theme text-sm font-semibold"
            @click="refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      <div class="flex-1 min-h-0">
        <SessionList
          :sessions="sessions"
          :total-count="totalCount"
          :loading="isLoading"
          @select="handleSessionSelect"
        />
      </div>
    </div>

    <EventDetailDrawer
      v-if="selectedEvent"
      :event="selectedEvent"
      :session-id="selectedSessionId"
      @close="closeDrawer"
    />

    <div
      v-if="error"
      class="mx-4 mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
    >
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import EventDetailDrawer from './EventDetailDrawer.vue';
import FilterBar from './FilterBar.vue';
import SessionList from './SessionList.vue';
import { useHistory } from '../composables/useHistory';
import type { SessionFilters, SessionSummary } from '../types/history';
import type { HookEvent } from '../types';

const {
  sessions,
  totalCount,
  filters,
  filterOptions,
  isLoading,
  selectedSessionDetail,
  error,
  fetchFilterOptions,
  fetchSessions,
  fetchSessionDetail,
  updateFilters,
  clearSelectedSession
} = useHistory();

const selectedEvent = ref<HookEvent | null>(null);
const selectedSessionId = ref('');

onMounted(async () => {
  await fetchFilterOptions();
  await fetchSessions();
});

const handleFilterChange = (nextFilters: SessionFilters) => {
  updateFilters({
    ...nextFilters,
    offset: 0
  });
  fetchSessions();
  closeDrawer();
};

const handleSessionSelect = async (session: SessionSummary) => {
  selectedSessionId.value = session.session_id;
  selectedEvent.value = null;
  await fetchSessionDetail(session.session_id);
  const detail = selectedSessionDetail.value;
  if (detail) {
    selectedEvent.value = detail.critical_events[0] || detail.events[0] || null;
  }
};

const closeDrawer = () => {
  selectedEvent.value = null;
  selectedSessionId.value = '';
  clearSelectedSession();
};

const refresh = () => {
  fetchSessions();
};
</script>
