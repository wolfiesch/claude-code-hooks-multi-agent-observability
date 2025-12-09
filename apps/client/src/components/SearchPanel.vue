<template>
  <div class="bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)] border-b-2 border-[var(--theme-primary)] px-3 py-4 mobile:py-2 shadow-lg">
    <div class="flex flex-wrap gap-3 items-end mobile:flex-col mobile:items-stretch">
      <!-- Search Input -->
      <div class="flex-[2] min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Search Events
        </label>
        <div class="relative">
          <input
            v-model="searchQuery"
            @input="debouncedSearch"
            type="text"
            placeholder="Search payload, summary, chat..."
            class="w-full px-4 py-2 pl-10 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-md hover:shadow-lg transition-all duration-200"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary)]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <span v-if="isLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
            <svg class="animate-spin h-5 w-5 text-[var(--theme-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
        </div>
      </div>

      <!-- Time Range Quick Buttons -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Time Range
        </label>
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="range in timeRanges"
            :key="range.label"
            @click="setTimeRange(range.value)"
            :class="[
              'px-3 py-2 mobile:px-2 mobile:py-1.5 text-sm mobile:text-xs font-medium rounded-lg transition-all duration-200',
              activeTimeRange === range.value
                ? 'bg-[var(--theme-primary)] text-white shadow-lg'
                : 'bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] border border-[var(--theme-border-primary)] hover:bg-[var(--theme-bg-secondary)]'
            ]"
          >
            {{ range.label }}
          </button>
        </div>
      </div>

      <!-- Agent Type Filter -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Agent Type
        </label>
        <select
          v-model="agentType"
          @change="performSearch"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-md hover:shadow-lg transition-all duration-200"
        >
          <option value="">All Agents</option>
          <option v-for="agent in filterOptions.agent_types" :key="agent" :value="agent">
            {{ agent }}
          </option>
        </select>
      </div>

      <!-- Event Type Filter -->
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Event Type
        </label>
        <select
          v-model="eventType"
          @change="performSearch"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-md hover:shadow-lg transition-all duration-200"
        >
          <option value="">All Types</option>
          <option v-for="type in filterOptions.hook_event_types" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <!-- Clear / Search Buttons -->
      <div class="flex gap-2 mobile:w-full">
        <button
          @click="performSearch"
          class="px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm font-medium text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)] rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
        >
          Search
        </button>
        <button
          v-if="hasActiveSearch"
          @click="clearSearch"
          class="px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm font-medium text-[var(--theme-text-secondary)] bg-[var(--theme-bg-primary)] hover:bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-lg transition-all duration-200"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="searchResults.length > 0 || hasActiveSearch" class="mt-3 flex items-center justify-between">
      <span class="text-sm text-[var(--theme-text-secondary)]">
        <span v-if="hasActiveSearch">
          Found <strong class="text-[var(--theme-primary)]">{{ searchResults.length }}</strong> results
          <span v-if="searchQuery"> for "<span class="text-[var(--theme-primary)]">{{ searchQuery }}</span>"</span>
        </span>
      </span>
      <!-- [*TO-DO*] - Add saved presets dropdown here -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { HookEvent, FilterOptions } from '../types';
import { API_BASE_URL } from '../config';

defineProps<{
  modelValue?: HookEvent[];
}>();

const emit = defineEmits<{
  'update:modelValue': [events: HookEvent[]];
  'search': [results: HookEvent[]];
  'clear': [];
}>();

// State
const searchQuery = ref('');
const agentType = ref('');
const eventType = ref('');
const activeTimeRange = ref<string | null>(null);
const fromTimestamp = ref<number | null>(null);
const toTimestamp = ref<number | null>(null);
const isLoading = ref(false);
const searchResults = ref<HookEvent[]>([]);
const filterOptions = ref<FilterOptions>({
  source_apps: [],
  session_ids: [],
  hook_event_types: [],
  agent_types: []
});

// Time range options
const timeRanges = [
  { label: 'Last Hour', value: 'hour' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'week' }
];

// Computed
const hasActiveSearch = computed(() => {
  return searchQuery.value || agentType.value || eventType.value || activeTimeRange.value;
});

// Debounce search
let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSearch = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    performSearch();
  }, 300);
};

// Set time range
const setTimeRange = (range: string) => {
  const now = Date.now();
  activeTimeRange.value = range;

  switch (range) {
    case 'hour':
      fromTimestamp.value = now - 60 * 60 * 1000;
      toTimestamp.value = now;
      break;
    case 'today':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      fromTimestamp.value = today.getTime();
      toTimestamp.value = now;
      break;
    case 'yesterday':
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      fromTimestamp.value = yesterday.getTime();
      toTimestamp.value = yesterdayEnd.getTime();
      break;
    case 'week':
      fromTimestamp.value = now - 7 * 24 * 60 * 60 * 1000;
      toTimestamp.value = now;
      break;
    default:
      fromTimestamp.value = null;
      toTimestamp.value = null;
  }

  performSearch();
};

// Perform search
const performSearch = async () => {
  isLoading.value = true;

  try {
    const params = new URLSearchParams();

    if (searchQuery.value) {
      params.set('q', searchQuery.value);
    }
    if (fromTimestamp.value) {
      params.set('from', fromTimestamp.value.toString());
    }
    if (toTimestamp.value) {
      params.set('to', toTimestamp.value.toString());
    }
    if (agentType.value) {
      params.set('agent_type', agentType.value);
    }
    if (eventType.value) {
      params.set('event_type', eventType.value);
    }
    params.set('limit', '500');

    const response = await fetch(`${API_BASE_URL}/events/search?${params.toString()}`);

    if (response.ok) {
      const data = await response.json();
      searchResults.value = data.events;
      emit('update:modelValue', data.events);
      emit('search', data.events);
    }
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    isLoading.value = false;
  }
};

// Clear search
const clearSearch = () => {
  searchQuery.value = '';
  agentType.value = '';
  eventType.value = '';
  activeTimeRange.value = null;
  fromTimestamp.value = null;
  toTimestamp.value = null;
  searchResults.value = [];
  emit('clear');
};

// Fetch filter options
const fetchFilterOptions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/events/filter-options`);
    if (response.ok) {
      filterOptions.value = await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch filter options:', error);
  }
};

// Store interval ID for cleanup
let filterOptionsInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchFilterOptions();
  // Refresh filter options periodically
  filterOptionsInterval = setInterval(fetchFilterOptions, 30000);
});

onUnmounted(() => {
  // Clean up interval to prevent memory leak
  if (filterOptionsInterval) {
    clearInterval(filterOptionsInterval);
    filterOptionsInterval = null;
  }
  // Clean up debounce timeout
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
});
</script>
