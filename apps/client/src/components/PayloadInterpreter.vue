<template>
  <div class="space-y-3">
    <!-- Status Badge (for tool events) -->
    <div v-if="showStatusBadge" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-lg">{{ toolIcon }}</span>
        <span class="font-bold text-[var(--theme-text-primary)]">{{ toolName }}</span>
      </div>
      <span
        class="px-2 py-0.5 rounded-full text-xs font-bold border"
        :class="statusClasses"
      >
        {{ statusText }}
      </span>
    </div>

    <!-- Visual Diff (for PostToolUse with previous output) -->
    <PayloadDiff v-if="diffInfo" :diff-info="diffInfo" />

    <!-- Priority Fields -->
    <div class="space-y-2">
      <PayloadField
        v-for="field in priorityFields"
        :key="field.key"
        :label="field.label"
        :value="field.value"
        :icon="field.icon"
        :wrap="field.wrap"
        :is-path="field.isPath"
        :is-url="field.isUrl"
        :is-error="field.isError"
      />
    </div>

    <!-- Duration (for PostToolUse) -->
    <div v-if="showDuration" class="flex items-center gap-2 text-sm">
      <span class="text-base">⏱️</span>
      <span class="text-[var(--theme-text-secondary)] font-medium">Duration:</span>
      <span class="font-mono text-[var(--theme-text-primary)]">{{ formattedDuration }}</span>
    </div>

    <!-- Other Details (collapsible) -->
    <div v-if="otherFields.length > 0" class="mt-3">
      <button
        @click.stop="showOtherDetails = !showOtherDetails"
        class="flex items-center gap-2 text-sm text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/50 rounded px-1"
        :aria-expanded="showOtherDetails"
        aria-label="Toggle other details (Press O)"
        title="Toggle other details (Press O)"
      >
        <span class="text-xs">{{ showOtherDetails ? '▼' : '▶' }}</span>
        <span>Other details ({{ otherFields.length }} fields)</span>
      </button>

      <div v-if="showOtherDetails" class="mt-2 pl-4 space-y-1.5 border-l-2 border-[var(--theme-border-primary)]">
        <PayloadField
          v-for="field in otherFields"
          :key="field.key"
          :label="field.label"
          :value="field.value"
          :icon="field.icon"
          :is-error="field.isError"
          compact
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import PayloadField from './PayloadField.vue';
import PayloadDiff from './PayloadDiff.vue';
import { useToolOutputHistory, type DiffInfo } from '../composables/useToolOutputHistory';
import { useExpandedState } from '../composables/useExpandedState';
import type { HookEvent } from '../types';

interface Props {
  payload: Record<string, unknown>;
  eventType: string;
  event?: HookEvent; // Optional full event for diff tracking
}

const props = defineProps<Props>();

// Persistent state for "Other details" section
const storageKey = props.event?.id ? `payload-other-details-${props.event.id}` : 'payload-other-details-default';
const { isExpanded: showOtherDetails } = useExpandedState(storageKey, false);

// Tool output history tracking
const { recordToolOutput, getDiffInfo } = useToolOutputHistory();

// Compute diff info for PostToolUse events
const diffInfo = computed<DiffInfo | null>(() => {
  if (!props.event || props.eventType !== 'PostToolUse') return null;
  return getDiffInfo(props.event);
});

// Record tool output when component is mounted (for future comparisons)
onMounted(() => {
  if (props.event && props.eventType === 'PostToolUse') {
    recordToolOutput(props.event);
  }
});

// Field contracts per event type
const EVENT_FIELD_CONTRACTS: Record<string, {
  priority: string[];
  labels: Record<string, string>;
  icons?: Record<string, string>;
  wrapFields?: string[];
}> = {
  PreToolUse: {
    priority: ['tool_name', 'tool_input.command', 'tool_input.file_path', 'tool_input.pattern', 'tool_input.url', 'tool_input.prompt'],
    labels: {
      'tool_name': 'Tool',
      'tool_input.command': 'Command',
      'tool_input.file_path': 'File',
      'tool_input.pattern': 'Pattern',
      'tool_input.url': 'URL',
      'tool_input.prompt': 'Prompt'
    },
    icons: {
      'tool_name': '🔧',
      'tool_input.command': '💻',
      'tool_input.file_path': '📄',
      'tool_input.pattern': '🔍',
      'tool_input.url': '🌐',
      'tool_input.prompt': '💬'
    },
    wrapFields: ['tool_input.command', 'tool_input.prompt']
  },
  PostToolUse: {
    priority: ['tool_name', 'tool_input.command', 'tool_input.file_path', 'tool_input.pattern', 'tool_result.error', 'tool_output'],
    labels: {
      'tool_name': 'Tool',
      'tool_input.command': 'Command',
      'tool_input.file_path': 'File',
      'tool_input.pattern': 'Pattern',
      'tool_result.error': 'Error',
      'tool_output': 'Output'
    },
    icons: {
      'tool_name': '🔧',
      'tool_input.command': '💻',
      'tool_input.file_path': '📄',
      'tool_input.pattern': '🔍',
      'tool_result.error': '❌',
      'tool_output': '📤'
    },
    wrapFields: ['tool_input.command', 'tool_result.error', 'tool_output']
  },
  UserPromptSubmit: {
    priority: ['prompt'],
    labels: { 'prompt': 'User Prompt' },
    icons: { 'prompt': '💬' },
    wrapFields: ['prompt']
  },
  SessionStart: {
    priority: ['source', 'cwd', 'transcript_path'],
    labels: {
      'source': 'Source',
      'cwd': 'Working Directory',
      'transcript_path': 'Transcript'
    },
    icons: {
      'source': '🚀',
      'cwd': '📂',
      'transcript_path': '📝'
    }
  },
  SessionEnd: {
    priority: ['source', 'session_duration'],
    labels: {
      'source': 'Source',
      'session_duration': 'Duration'
    },
    icons: {
      'source': '🏁',
      'session_duration': '⏱️'
    }
  },
  PreCompact: {
    priority: ['trigger', 'context_size', 'reason'],
    labels: {
      'trigger': 'Trigger',
      'context_size': 'Context Size',
      'reason': 'Reason'
    },
    icons: {
      'trigger': '📦',
      'context_size': '📊',
      'reason': '💡'
    }
  },
  Notification: {
    priority: ['message', 'level', 'title'],
    labels: {
      'message': 'Message',
      'level': 'Level',
      'title': 'Title'
    },
    icons: {
      'message': '📣',
      'level': '📊',
      'title': '📌'
    }
  },
  Stop: {
    priority: ['reason', 'stop_reason'],
    labels: {
      'reason': 'Reason',
      'stop_reason': 'Stop Reason'
    },
    icons: {
      'reason': '🛑',
      'stop_reason': '🛑'
    }
  },
  SubagentStop: {
    priority: ['reason', 'subagent_type'],
    labels: {
      'reason': 'Reason',
      'subagent_type': 'Subagent Type'
    },
    icons: {
      'reason': '🛑',
      'subagent_type': '👥'
    }
  }
};

// Get nested value from object using dot notation
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
};

// Check if this is a tool event
const isToolEvent = computed(() =>
  props.eventType === 'PreToolUse' || props.eventType === 'PostToolUse'
);

const showStatusBadge = computed(() => isToolEvent.value && props.payload.tool_name);

const toolName = computed(() => String(props.payload.tool_name || ''));

const toolIcon = computed(() => {
  const name = toolName.value.toLowerCase();
  if (name.includes('bash')) return '💻';
  if (name.includes('read')) return '📖';
  if (name.includes('write')) return '✍️';
  if (name.includes('edit')) return '✏️';
  if (name.includes('glob')) return '🔍';
  if (name.includes('grep')) return '🔎';
  if (name.includes('task')) return '📋';
  if (name.includes('web')) return '🌐';
  return '🔧';
});

// Status detection for PostToolUse
const status = computed(() => {
  if (props.eventType !== 'PostToolUse') return null;

  // Check for explicit status
  if (props.payload.status) return String(props.payload.status);

  // Check tool_result for success indicators
  const result = props.payload.tool_result;
  if (result && typeof result === 'object') {
    const resultObj = result as Record<string, unknown>;
    if (resultObj.success === false || resultObj.error) return 'error';
    if (resultObj.success === true) return 'success';
  }

  // Default to success for PostToolUse without explicit failure
  return 'success';
});

const statusText = computed(() => {
  switch (status.value) {
    case 'success': return '✓ Success';
    case 'error': return '✗ Failed';
    case 'cancelled': return '⊘ Cancelled';
    default: return status.value || '';
  }
});

const statusClasses = computed(() => {
  switch (status.value) {
    case 'success': return 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300';
    case 'error': return 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300';
    case 'cancelled': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300';
    default: return 'bg-gray-100 dark:bg-gray-900/30 border-gray-500 text-gray-700 dark:text-gray-300';
  }
});

// Duration for PostToolUse
const showDuration = computed(() =>
  props.eventType === 'PostToolUse' && props.payload.duration_ms !== undefined
);

const formattedDuration = computed(() => {
  const ms = Number(props.payload.duration_ms);
  if (isNaN(ms)) return '(not provided)';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
});

// Helper function to detect if a field represents an error
const isErrorField = (key: string, value: unknown): boolean => {
  // Check field name for error indicators
  const errorKeywords = ['error', 'failure', 'failed', 'exception', 'fault'];
  const keyLower = key.toLowerCase();
  const hasErrorKeyword = errorKeywords.some(keyword => keyLower.includes(keyword));

  // Check value for error indicators
  if (typeof value === 'string') {
    const valueLower = value.toLowerCase();
    // Don't flag normal status values
    if (value === 'success' || value === 'ok' || value === 'completed') {
      return false;
    }
    // Flag error-like strings
    if (valueLower.includes('error') || valueLower.includes('failed') || valueLower.includes('exception')) {
      return true;
    }
  }

  // Check if value indicates failure
  if (keyLower.includes('status') && value === 'error') return true;
  if (keyLower.includes('success') && value === false) return true;

  return hasErrorKeyword && value !== null && value !== undefined && value !== '';
};

// Build priority fields based on event type
const priorityFields = computed(() => {
  const contract = EVENT_FIELD_CONTRACTS[props.eventType] || {
    priority: [],
    labels: {},
    icons: {},
    wrapFields: []
  };

  const fields: Array<{
    key: string;
    label: string;
    value: unknown;
    icon?: string;
    wrap?: boolean;
    isPath?: boolean;
    isUrl?: boolean;
    isError?: boolean;
  }> = [];

  for (const path of contract.priority) {
    // Skip tool_name if we're showing the status badge
    if (path === 'tool_name' && showStatusBadge.value) continue;

    const value = getNestedValue(props.payload, path);
    if (value !== undefined && value !== null && value !== '') {
      const isPath = path.includes('file_path') || path.includes('cwd') || path.includes('transcript_path');
      const isUrl = path.includes('url');
      const isError = isErrorField(path, value);

      fields.push({
        key: path,
        label: contract.labels[path] || formatLabel(path),
        value,
        icon: contract.icons?.[path],
        wrap: contract.wrapFields?.includes(path),
        isPath,
        isUrl,
        isError
      });
    }
  }

  return fields;
});

// Build other fields (not in priority list)
const otherFields = computed(() => {
  const contract = EVENT_FIELD_CONTRACTS[props.eventType] || { priority: [] };
  const priorityKeys = new Set(contract.priority);

  // Also skip these internal/meta fields
  const skipKeys = new Set([
    'tool_name', 'session_id', 'transcript_path', 'cwd',
    'duration_ms', 'status', 'tool_result'
  ]);

  const fields: Array<{
    key: string;
    label: string;
    value: unknown;
    icon?: string;
    isError?: boolean;
  }> = [];

  const flattenObject = (obj: Record<string, unknown>, prefix = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Skip priority fields and internal fields
      if (priorityKeys.has(fullKey) || skipKeys.has(key)) continue;

      // For nested objects, flatten one level
      if (value && typeof value === 'object' && !Array.isArray(value) && prefix === '') {
        flattenObject(value as Record<string, unknown>, key);
      } else if (value !== undefined && value !== null && value !== '') {
        const isError = isErrorField(fullKey, value);
        fields.push({
          key: fullKey,
          label: formatLabel(fullKey),
          value,
          isError
        });
      }
    }
  };

  flattenObject(props.payload);
  return fields;
});

// Format a key path into a human-readable label
const formatLabel = (path: string): string => {
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, s => s.toUpperCase());
};

// Generate parsed text for copying
const getParsedText = (): string => {
  const lines: string[] = [];

  if (showStatusBadge.value) {
    lines.push(`Tool: ${toolName.value} [${statusText.value}]`);
    lines.push('');
  }

  for (const field of priorityFields.value) {
    const valueStr = typeof field.value === 'object'
      ? JSON.stringify(field.value, null, 2)
      : String(field.value);
    lines.push(`${field.label}: ${valueStr}`);
  }

  if (showDuration.value) {
    lines.push(`Duration: ${formattedDuration.value}`);
  }

  if (otherFields.value.length > 0) {
    lines.push('');
    lines.push('Other Details:');
    for (const field of otherFields.value) {
      const valueStr = typeof field.value === 'object'
        ? JSON.stringify(field.value, null, 2)
        : String(field.value);
      lines.push(`  ${field.label}: ${valueStr}`);
    }
  }

  return lines.join('\n');
};

// Toggle "Other details" section (called by parent keyboard shortcut)
const toggleOtherDetails = () => {
  showOtherDetails.value = !showOtherDetails.value;
};

// Expose for parent component
defineExpose({ getParsedText, toggleOtherDetails });
</script>
