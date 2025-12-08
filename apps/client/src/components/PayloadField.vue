<template>
  <div
    :class="[
      'flex gap-2',
      compact ? 'items-start text-xs' : 'items-start text-sm',
      isError ? 'px-2 py-1.5 -mx-2 -my-1 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-900/20' : ''
    ]"
  >
    <!-- Icon (auto-generated or explicit) -->
    <span v-if="autoIcon" class="flex-shrink-0" :class="compact ? 'text-sm' : 'text-base'">
      {{ autoIcon }}
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
        class="font-mono bg-[var(--theme-bg-tertiary)] px-2 py-1.5 rounded border border-[var(--theme-border-primary)] whitespace-pre-wrap break-words syntax-highlighted"
        :class="compact ? 'text-xs' : 'text-sm'"
        v-html="highlightedWrappedValue"
      ></div>

      <!-- Array Value (expandable) -->
      <div v-else-if="isArray">
        <button
          v-if="!arrayExpanded"
          @click.stop="arrayExpanded = true"
          class="font-mono text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          {{ formattedValue }} <span class="text-xs">[expand]</span>
        </button>
        <pre
          v-else
          class="font-mono text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] px-2 py-1.5 rounded border border-[var(--theme-border-primary)] overflow-x-auto"
          :class="compact ? 'text-xs max-h-32' : 'text-sm max-h-48'"
        >{{ formattedArray }}</pre>
      </div>

      <!-- Object Value (existing objects) -->
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

      <!-- Boolean Badge -->
      <span
        v-else-if="fieldType === 'boolean'"
        class="inline-flex items-center px-2 py-0.5 rounded font-bold text-xs"
        :class="value ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-500' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-500'"
      >
        {{ formattedValue }}
      </span>

      <!-- ID / Timestamp / Number with monospace styling -->
      <span
        v-else-if="fieldType === 'id' || fieldType === 'timestamp' || fieldType === 'number'"
        class="font-mono text-[var(--theme-text-primary)] px-1.5 py-0.5 bg-[var(--theme-bg-tertiary)] rounded border border-[var(--theme-border-primary)]"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        {{ formattedValue }}
      </span>

      <!-- Simple Value with truncation and auto-linkified URLs -->
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
          v-else-if="containsUrl && !props.wrap"
          class="font-mono text-[var(--theme-text-primary)] break-all"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          <template v-for="(part, index) in linkifiedValue" :key="index">
            <a
              v-if="part.type === 'link'"
              :href="part.content"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              @click.stop
            >{{ part.content }}</a>
            <span v-else>{{ part.content }}</span>
          </template>
          <button
            v-if="showFull && isTruncated"
            @click.stop="showFull = false"
            class="text-[var(--theme-primary)] hover:underline ml-1"
          >
            [less]
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
  isError?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  wrap: false,
  isPath: false,
  isUrl: false,
  compact: false,
  isError: false
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

// Helper function to detect URLs in text
const containsUrl = computed(() => {
  if (typeof props.value !== 'string') return false;
  // Match http(s)://, file://, and common URL patterns
  const urlRegex = /(https?:\/\/[^\s]+|file:\/\/[^\s]+|www\.[^\s]+)/gi;
  return urlRegex.test(props.value);
});

// Helper function to linkify URLs in text
const linkifiedValue = computed(() => {
  if (typeof props.value !== 'string') return String(props.value);
  const urlRegex = /(https?:\/\/[^\s]+|file:\/\/[^\s]+)/gi;
  const text = String(props.value);
  const parts: Array<{ type: 'text' | 'link', content: string }> = [];

  let lastIndex = 0;
  let match;
  const regex = new RegExp(urlRegex);

  while ((match = regex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // Add the URL
    parts.push({ type: 'link', content: match[0] });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
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

// Smart field type detection
const fieldType = computed(() => {
  const labelLower = props.label.toLowerCase();

  // ID fields
  if (labelLower.includes('id') || labelLower.includes('uuid') || labelLower.includes('key')) {
    return 'id';
  }

  // Timestamp fields
  if (labelLower.includes('time') || labelLower.includes('date') || labelLower.includes('at') || labelLower === 'timestamp') {
    return 'timestamp';
  }

  // Boolean fields
  if (typeof props.value === 'boolean') {
    return 'boolean';
  }

  // Number fields
  if (typeof props.value === 'number') {
    return 'number';
  }

  // Array fields
  if (Array.isArray(props.value)) {
    return 'array';
  }

  return 'default';
});

// Auto-generated icon based on field type
const autoIcon = computed(() => {
  if (props.icon) return props.icon; // Explicit icon takes precedence

  // Error fields get a warning icon
  if (props.isError) return '⚠️';

  switch (fieldType.value) {
    case 'id': return '🏷️';
    case 'timestamp': return '🕒';
    case 'boolean': return props.value ? '✅' : '❌';
    case 'number': return '🔢';
    case 'array': return '📋';
    default: return undefined;
  }
});

// Helper function to format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
};

// Formatted value for special types
const formattedValue = computed(() => {
  // Timestamp formatting with relative time and PST timezone
  if (fieldType.value === 'timestamp' && typeof props.value === 'number') {
    const date = new Date(props.value);
    const absoluteTime = date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
    const relativeTime = formatRelativeTime(props.value);
    return `${relativeTime} (${absoluteTime})`;
  }

  // Number formatting (add commas)
  if (fieldType.value === 'number' && typeof props.value === 'number') {
    return props.value.toLocaleString('en-US');
  }

  // Boolean rendering
  if (fieldType.value === 'boolean') {
    return props.value ? 'true' : 'false';
  }

  // Array summary
  if (fieldType.value === 'array' && Array.isArray(props.value)) {
    return `[${props.value.length} items]`;
  }

  return stringValue.value;
});

// Is this an array that can be expanded?
const isArray = computed(() => fieldType.value === 'array');

const arrayExpanded = ref(false);

const formattedArray = computed(() => {
  if (!isArray.value || !Array.isArray(props.value)) return '';
  return JSON.stringify(props.value, null, 2);
});

// Helper function to apply basic syntax highlighting to wrapped text
const highlightedWrappedValue = computed(() => {
  const text = stringValue.value;

  // Escape HTML to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Apply basic syntax highlighting for shell commands
  let highlighted = escaped;

  // Highlight common shell commands (cd, ls, git, npm, etc.)
  highlighted = highlighted.replace(
    /\b(cd|ls|git|npm|pnpm|yarn|bun|docker|make|curl|wget|cat|grep|find|sed|awk|python|node|bash|sh)\b/g,
    '<span class="syntax-command">$1</span>'
  );

  // Highlight flags/options (-flag, --flag)
  highlighted = highlighted.replace(
    /(^|\s)(--?[\w-]+)/gm,
    '$1<span class="syntax-flag">$2</span>'
  );

  // Highlight strings in quotes
  highlighted = highlighted.replace(
    /(["'])([^"']*)\1/g,
    '<span class="syntax-string">$1$2$1</span>'
  );

  // Highlight file paths
  highlighted = highlighted.replace(
    /([./~][\w\/.@-]+)/g,
    '<span class="syntax-path">$1</span>'
  );

  return `<span class="text-[var(--theme-text-primary)]">${highlighted}</span>`;
});
</script>

<style scoped>
/* Syntax highlighting for code fields */
.syntax-highlighted :deep(.syntax-command) {
  color: #0ea5e9; /* Sky blue for commands */
  font-weight: 600;
}

.syntax-highlighted :deep(.syntax-flag) {
  color: #8b5cf6; /* Purple for flags */
}

.syntax-highlighted :deep(.syntax-string) {
  color: #10b981; /* Green for strings */
}

.syntax-highlighted :deep(.syntax-path) {
  color: #f59e0b; /* Amber for paths */
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .syntax-highlighted :deep(.syntax-command) {
    color: #38bdf8; /* Lighter sky blue */
  }

  .syntax-highlighted :deep(.syntax-flag) {
    color: #a78bfa; /* Lighter purple */
  }

  .syntax-highlighted :deep(.syntax-string) {
    color: #34d399; /* Lighter green */
  }

  .syntax-highlighted :deep(.syntax-path) {
    color: #fbbf24; /* Lighter amber */
  }
}
</style>
