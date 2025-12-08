<template>
  <div v-if="diffInfo && diffInfo.hasChanges" class="space-y-2">
    <!-- Diff Badge -->
    <div
      class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all duration-200"
      :class="badgeClasses"
      @click.stop="expanded = !expanded"
    >
      <span class="text-lg">{{ changeIcon }}</span>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm">{{ changeLabel }}</span>
          <span class="text-xs opacity-75">{{ diffInfo.summary }}</span>
        </div>
        <div class="text-xs opacity-60">
          vs {{ formatRelativeTime(diffInfo.previousTimestamp) }}
        </div>
      </div>
      <button
        class="text-xs px-2 py-0.5 rounded transition-colors"
        :class="expandButtonClasses"
      >
        {{ expanded ? '▲ Hide' : '▼ Show' }}
      </button>
    </div>

    <!-- Expanded Diff View -->
    <div v-if="expanded" class="mt-2 space-y-2">
      <!-- Field Changes Summary -->
      <div v-if="hasFieldChanges" class="flex flex-wrap gap-2 text-xs">
        <span
          v-for="field in diffInfo.addedFields"
          :key="'add-' + field"
          class="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-500"
        >
          + {{ field }}
        </span>
        <span
          v-for="field in diffInfo.removedFields"
          :key="'rem-' + field"
          class="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-500"
        >
          - {{ field }}
        </span>
        <span
          v-for="field in diffInfo.modifiedFields"
          :key="'mod-' + field"
          class="px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-500"
        >
          ~ {{ field }}
        </span>
      </div>

      <!-- Side by Side Comparison -->
      <div class="grid grid-cols-2 gap-2">
        <!-- Previous Value -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-[var(--theme-text-tertiary)] flex items-center gap-1">
            <span>📜</span>
            Previous ({{ formatRelativeTime(diffInfo.previousTimestamp) }})
          </div>
          <pre
            class="text-xs p-2 rounded-lg border overflow-x-auto max-h-32 overflow-y-auto font-mono bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-[var(--theme-text-primary)]"
          >{{ formatValue(diffInfo.previousValue) }}</pre>
        </div>

        <!-- Current Value -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-[var(--theme-text-tertiary)] flex items-center gap-1">
            <span>📄</span>
            Current
          </div>
          <pre
            class="text-xs p-2 rounded-lg border overflow-x-auto max-h-32 overflow-y-auto font-mono bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-[var(--theme-text-primary)]"
          >{{ formatValue(diffInfo.currentValue) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DiffInfo } from '../composables/useToolOutputHistory';

interface Props {
  diffInfo: DiffInfo | null;
}

const props = defineProps<Props>();
const expanded = ref(false);

const changeIcon = computed(() => {
  if (!props.diffInfo) return '';
  switch (props.diffInfo.changeType) {
    case 'added': return '➕';
    case 'removed': return '➖';
    case 'modified': return '🔄';
    default: return '⚪';
  }
});

const changeLabel = computed(() => {
  if (!props.diffInfo) return '';
  switch (props.diffInfo.changeType) {
    case 'added': return 'Output Added';
    case 'removed': return 'Output Removed';
    case 'modified': return 'Output Changed';
    default: return 'No Changes';
  }
});

const badgeClasses = computed(() => {
  if (!props.diffInfo) return '';
  switch (props.diffInfo.changeType) {
    case 'added':
      return 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-900 dark:text-green-100';
    case 'removed':
      return 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-900 dark:text-red-100';
    case 'modified':
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-900 dark:text-yellow-100';
    default:
      return 'bg-gray-50 dark:bg-gray-900/20 border-gray-500 text-gray-900 dark:text-gray-100';
  }
});

const expandButtonClasses = computed(() => {
  if (!props.diffInfo) return '';
  switch (props.diffInfo.changeType) {
    case 'added':
      return 'bg-green-200 dark:bg-green-800 hover:bg-green-300 dark:hover:bg-green-700';
    case 'removed':
      return 'bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700';
    case 'modified':
      return 'bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700';
    default:
      return 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700';
  }
});

const hasFieldChanges = computed(() => {
  if (!props.diffInfo) return false;
  return (
    props.diffInfo.addedFields.length > 0 ||
    props.diffInfo.removedFields.length > 0 ||
    props.diffInfo.modifiedFields.length > 0
  );
});

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const formatValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 500) {
      return value.slice(0, 500) + '... (truncated)';
    }
    return value;
  }
  return JSON.stringify(value, null, 2);
};
</script>
