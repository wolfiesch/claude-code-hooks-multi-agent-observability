<template>
  <div
    :class="[
      'flex gap-2',
      compact ? 'items-start text-xs' : 'items-start text-sm'
    ]"
  >
    <!-- Icon -->
    <span v-if="icon" class="flex-shrink-0" :class="compact ? 'text-sm' : 'text-base'">
      {{ icon }}
    </span>

    <!-- Label -->
    <span
      class="flex-shrink-0 font-semibold text-[var(--theme-text-secondary)]"
      :class="compact ? 'min-w-[80px]' : 'min-w-[100px]'"
    >
      {{ label }}:
    </span>

    <!-- Value -->
    <div class="flex-1 min-w-0">
      <!-- URL Value -->
      <a
        v-if="isUrl && typeof value === 'string'"
        :href="value"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer break-all"
        :class="compact ? 'text-xs' : 'text-sm'"
        @click.stop
      >
        {{ displayValue }}
      </a>

      <!-- Path Value (copy on click) -->
      <button
        v-else-if="isPath && typeof value === 'string'"
        @click.stop="copyToClipboard"
        class="font-mono text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded px-1 -mx-1 cursor-pointer transition-colors text-left break-all"
        :class="compact ? 'text-xs' : 'text-sm'"
        :title="copyTitle"
      >
        {{ displayValue }}
        <span v-if="copied" class="ml-1 text-xs text-green-700 dark:text-green-300">✓</span>
      </button>

      <!-- Wrapped Value (for commands/prompts - never truncate) -->
      <div
        v-else-if="wrap"
        class="font-mono text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] px-2 py-1.5 rounded border border-[var(--theme-border-primary)] whitespace-pre-wrap break-words"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        {{ stringValue }}
      </div>

      <!-- Object/Array Value -->
      <div v-else-if="isObject">
        <button
          v-if="!expanded"
          @click.stop="expanded = true"
          class="font-mono text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          {{ objectSummary }} <span class="text-xs">[expand]</span>
        </button>
        <pre
          v-else
          class="font-mono text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] px-2 py-1.5 rounded border border-[var(--theme-border-primary)] overflow-x-auto"
          :class="compact ? 'text-xs max-h-32' : 'text-sm max-h-48'"
        >{{ formattedObject }}</pre>
      </div>

      <!-- Simple Value with truncation -->
      <div v-else class="flex items-center gap-1">
        <span
          v-if="!showFull && isTruncated"
          class="font-mono text-[var(--theme-text-primary)]"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          {{ truncatedValue }}
          <button
            @click.stop="showFull = true"
            class="text-[var(--theme-primary)] hover:underline ml-1"
          >
            [more]
          </button>
        </span>
        <span
          v-else
          class="font-mono text-[var(--theme-text-primary)] break-all"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          {{ stringValue }}
          <button
            v-if="showFull && isTruncated"
            @click.stop="showFull = false"
            class="text-[var(--theme-primary)] hover:underline ml-1"
          >
            [less]
          </button>
        </span>
      </div>

      <!-- Not provided badge -->
      <span
        v-if="value === undefined || value === null || value === ''"
        class="text-[var(--theme-text-quaternary)] italic"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        (not provided)
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  label: string;
  value: unknown;
  icon?: string;
  wrap?: boolean;
  isPath?: boolean;
  isUrl?: boolean;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  wrap: false,
  isPath: false,
  isUrl: false,
  compact: false
});

const expanded = ref(false);
const showFull = ref(false);
const copied = ref(false);

const MAX_LENGTH = 100; // Truncate after this length

const stringValue = computed(() => {
  if (props.value === undefined || props.value === null) return '';
  if (typeof props.value === 'object') return JSON.stringify(props.value);
  return String(props.value);
});

const displayValue = computed(() => {
  if (props.isPath && typeof props.value === 'string') {
    // Show filename with parent for paths
    const parts = props.value.split('/');
    if (parts.length > 2) {
      return `.../${parts.slice(-2).join('/')}`;
    }
  }
  return stringValue.value;
});

const isTruncated = computed(() =>
  !props.wrap && stringValue.value.length > MAX_LENGTH
);

const truncatedValue = computed(() =>
  stringValue.value.slice(0, MAX_LENGTH) + '...'
);

const isObject = computed(() =>
  props.value !== null &&
  typeof props.value === 'object' &&
  !Array.isArray(props.value)
);

const objectSummary = computed(() => {
  if (!isObject.value) return '';
  const obj = props.value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
});

const formattedObject = computed(() => {
  if (!isObject.value) return '';
  return JSON.stringify(props.value, null, 2);
});

const copyTitle = computed(() =>
  copied.value ? 'Copied!' : 'Click to copy full path'
);

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(stringValue.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
</script>
