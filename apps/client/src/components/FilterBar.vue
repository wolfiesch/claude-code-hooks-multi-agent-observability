<template>
  <div class="w-full bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border-primary)] shadow-sm">
    <div class="flex flex-wrap items-end gap-4 p-4">
      <div class="min-w-[220px] flex-1">
        <TimeRangeSelector @change="handleTimeRangeChange" />
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--theme-text-secondary)] font-semibold uppercase">Source</label>
          <select
            v-model="localFilters.source_app"
            class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm min-w-[160px]"
            @change="emitFilterChange()"
          >
            <option value="">All sources</option>
            <option v-for="source in filterOptions.source_apps" :key="source" :value="source">
              {{ source }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--theme-text-secondary)] font-semibold uppercase">Repo</label>
          <select
            v-model="localFilters.repo_name"
            class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm min-w-[180px]"
            @change="emitFilterChange()"
          >
            <option value="">All repos</option>
            <option v-for="repo in filterOptions.repos" :key="repo" :value="repo">
              {{ repo }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--theme-text-secondary)] font-semibold uppercase">Status</label>
          <select
            v-model="localFilters.status"
            class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm min-w-[150px]"
            @change="emitFilterChange()"
          >
            <option value="">All statuses</option>
            <option v-for="status in filterOptions.statuses" :key="status" :value="status">
              {{ capitalize(status) }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2 pt-5">
          <input
            id="failures-only"
            v-model="failuresOnly"
            type="checkbox"
            class="h-4 w-4 rounded border-[var(--theme-border-primary)] text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
            @change="handleFailuresToggle"
          />
          <label for="failures-only" class="text-sm text-[var(--theme-text-secondary)]">Failures only</label>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--theme-text-secondary)] font-semibold uppercase">Sort</label>
          <select
            v-model="localFilters.sort_by"
            class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm min-w-[150px]"
            @change="emitFilterChange()"
          >
            <option value="recency">Recency</option>
            <option value="severity">Severity</option>
            <option value="duration">Duration</option>
            <option value="cost">Cost</option>
          </select>
        </div>

        <button
          type="button"
          class="h-[42px] px-3 rounded-md border border-[var(--theme-border-primary)] text-sm font-semibold text-[var(--theme-text-primary)] bg-[var(--theme-bg-secondary)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] transition-theme"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import TimeRangeSelector from './TimeRangeSelector.vue';
import type { HistoryFilterOptions, SessionFilters } from '../types/history';

const props = withDefaults(defineProps<{
  filters: SessionFilters;
  filterOptions: HistoryFilterOptions;
}>(), {
  filters: () => ({
    sort_by: 'recency'
  }),
  filterOptions: () => ({
    repos: [],
    source_apps: [],
    statuses: []
  })
});

const emit = defineEmits<{
  'filter-change': [filters: SessionFilters];
}>();

const localFilters = ref<SessionFilters>({
  ...props.filters,
  source_app: props.filters.source_app || '',
  repo_name: props.filters.repo_name || '',
  sort_by: props.filters.sort_by || 'recency'
});

const failuresOnly = computed({
  get: () => Boolean(localFilters.value.has_critical_events),
  set: (value: boolean) => {
    localFilters.value.has_critical_events = value || undefined;
  }
});

const emitFilterChange = () => {
  emit('filter-change', { ...localFilters.value });
};

const handleTimeRangeChange = (range: { start_time?: number; end_time?: number }) => {
  localFilters.value = {
    ...localFilters.value,
    ...range
  };
  emitFilterChange();
};

const handleFailuresToggle = () => {
  localFilters.value.has_critical_events = failuresOnly.value || undefined;
  emitFilterChange();
};

const resetFilters = () => {
  localFilters.value = {
    start_time: undefined,
    end_time: undefined,
    source_app: '',
    repo_name: '',
    status: undefined,
    has_critical_events: undefined,
    sort_by: 'recency'
  };
  emitFilterChange();
};

watch(() => props.filters, (next) => {
  localFilters.value = {
    ...next,
    source_app: next.source_app || '',
    repo_name: next.repo_name || '',
    sort_by: next.sort_by || 'recency'
  };
}, { deep: true });

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
</script>
