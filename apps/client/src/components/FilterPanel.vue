<template>
  <div class="bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)] border-b-2 border-[var(--theme-primary)] px-3 py-4 mobile:py-2 shadow-lg">
    <div class="flex flex-wrap gap-3 items-center mobile:flex-col mobile:items-stretch">
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Source App
        </label>
        <select
          v-model="localFilters.sourceApp"
          @change="updateSourceApp(($event.target as HTMLSelectElement).value)"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-md hover:shadow-lg transition-all duration-200"
        >
          <option value="">All Sources</option>
          <option v-for="app in sourceAppOptions" :key="app" :value="app">
            {{ app }}
          </option>
        </select>
      </div>
      
      <div class="flex-1 min-w-0 mobile:w-full">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Session ID
        </label>
        <select
          v-model="localFilters.sessionId"
          @change="updateSessionId(($event.target as HTMLSelectElement).value)"
          class="w-full px-4 py-2 mobile:px-2 mobile:py-1.5 text-base mobile:text-sm border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-md hover:shadow-lg transition-all duration-200"
        >
          <option value="">All Sessions</option>
          <option v-for="session in sessionIdOptions" :key="session" :value="session">
            {{ session.slice(0, 8) }}...
          </option>
        </select>
      </div>
      
      <div class="flex-1 min-w-0 mobile:w-full flex flex-col">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Event Types
        </label>
        <FilterDropdown
          label="Event Type"
          :options="eventTypeDropdownOptions"
          :model-value="localFilters.eventTypes"
          @update:modelValue="handleEventTypesChange"
        />
      </div>

      <div class="flex-1 min-w-0 mobile:w-full flex flex-col">
        <label class="block text-base mobile:text-sm font-bold text-[var(--theme-primary)] mb-1.5 drop-shadow-sm">
          Agent Types
        </label>
        <FilterDropdown
          label="Agent Type"
          :options="agentTypeDropdownOptions"
          :model-value="localFilters.agentTypes"
          @update:modelValue="handleAgentTypesChange"
        />
      </div>

      <button
        v-if="hasActiveFilters"
        @click="clearFilters"
        class="px-4 py-2 mobile:px-2 mobile:py-1.5 mobile:w-full text-base mobile:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FilterOption, FilterState } from '../types';
import FilterDropdown from './FilterDropdown.vue';

const props = withDefaults(defineProps<{
  filters: FilterState;
  sourceAppOptions?: string[];
  sessionIdOptions?: string[];
  agentTypeOptions?: string[];
  eventTypeOptions?: string[];
}>(), {
  sourceAppOptions: () => [],
  sessionIdOptions: () => [],
  agentTypeOptions: () => [],
  eventTypeOptions: () => []
});

const emit = defineEmits<{
  'update:filters': [filters: FilterState];
}>();

const localFilters = ref<FilterState>({
  sourceApp: props.filters.sourceApp,
  sessionId: props.filters.sessionId,
  eventTypes: new Set(props.filters.eventTypes),
  agentTypes: new Set(props.filters.agentTypes)
});

watch(() => props.filters, (next) => {
  localFilters.value = {
    sourceApp: next.sourceApp,
    sessionId: next.sessionId,
    eventTypes: new Set(next.eventTypes),
    agentTypes: new Set(next.agentTypes)
  };
}, { deep: true });

const hasActiveFilters = computed(() => {
  return Boolean(
    localFilters.value.sourceApp ||
    localFilters.value.sessionId ||
    localFilters.value.eventTypes.size ||
    localFilters.value.agentTypes.size
  );
});

const eventTypeDropdownOptions = computed<FilterOption[]>(() =>
  (props.eventTypeOptions || []).map(type => ({ label: type, value: type }))
);

const agentTypeDropdownOptions = computed<FilterOption[]>(() =>
  (props.agentTypeOptions || []).map(type => ({ label: type, value: type }))
);

const emitFilters = () => {
  emit('update:filters', {
    sourceApp: localFilters.value.sourceApp,
    sessionId: localFilters.value.sessionId,
    eventTypes: new Set(localFilters.value.eventTypes),
    agentTypes: new Set(localFilters.value.agentTypes)
  });
};

const clearFilters = () => {
  localFilters.value = {
    sourceApp: '',
    sessionId: '',
    eventTypes: new Set<string>(),
    agentTypes: new Set<string>()
  };
  emitFilters();
};

const updateSourceApp = (value: string) => {
  localFilters.value.sourceApp = value;
  emitFilters();
};

const updateSessionId = (value: string) => {
  localFilters.value.sessionId = value;
  emitFilters();
};

const handleAgentTypesChange = (values: Set<string>) => {
  localFilters.value.agentTypes = new Set(values);
  emitFilters();
};

const handleEventTypesChange = (values: Set<string>) => {
  localFilters.value.eventTypes = new Set(values);
  emitFilters();
};
</script>
