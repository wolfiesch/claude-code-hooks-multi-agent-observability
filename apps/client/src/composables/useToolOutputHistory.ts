import { reactive } from 'vue';
import type { HookEvent } from '../types';

// Store for tracking tool output history
// Key: session_id:tool_name:file_path (or just session_id:tool_name for tools without file_path)
interface ToolOutputEntry {
  eventId: number | undefined;
  timestamp: number;
  output: unknown;
  input: unknown;
}

interface ToolOutputStore {
  [key: string]: ToolOutputEntry[];
}

// Global reactive store
const toolOutputStore = reactive<ToolOutputStore>({});

// Maximum history entries per tool key
const MAX_HISTORY = 5;

/**
 * Generate a unique key for a tool invocation
 */
function getToolKey(event: HookEvent): string | null {
  const payload = event.payload;
  if (!payload?.tool_name) return null;

  const parts = [event.session_id, payload.tool_name];

  // Add file_path if available (for Read, Write, Edit, etc.)
  if (payload.tool_input?.file_path) {
    parts.push(payload.tool_input.file_path);
  }
  // Add pattern if available (for Grep, Glob)
  else if (payload.tool_input?.pattern) {
    parts.push(payload.tool_input.pattern);
  }
  // Add command snippet if available (for Bash)
  else if (payload.tool_input?.command) {
    // Use first 50 chars of command as identifier
    parts.push(payload.tool_input.command.slice(0, 50));
  }

  return parts.join(':');
}

/**
 * Composable for managing tool output history and detecting changes
 */
export function useToolOutputHistory() {
  /**
   * Record a tool output from a PostToolUse event
   */
  function recordToolOutput(event: HookEvent): void {
    if (event.hook_event_type !== 'PostToolUse') return;

    const key = getToolKey(event);
    if (!key) return;

    const entry: ToolOutputEntry = {
      eventId: event.id,
      timestamp: event.timestamp || Date.now(),
      output: event.payload.tool_output ?? event.payload.tool_result,
      input: event.payload.tool_input
    };

    if (!toolOutputStore[key]) {
      toolOutputStore[key] = [];
    }

    // Avoid duplicate entries for the same event
    const existing = toolOutputStore[key].find(e => e.eventId === event.id);
    if (existing) return;

    // Add to beginning of array (most recent first)
    toolOutputStore[key].unshift(entry);

    // Trim to max history
    if (toolOutputStore[key].length > MAX_HISTORY) {
      toolOutputStore[key].pop();
    }
  }

  /**
   * Get previous output for a tool invocation
   */
  function getPreviousOutput(event: HookEvent): ToolOutputEntry | null {
    if (event.hook_event_type !== 'PostToolUse') return null;

    const key = getToolKey(event);
    if (!key) return null;

    const history = toolOutputStore[key] || [];

    // Find the previous entry (not the current event)
    const previousEntries = history.filter(e => e.eventId !== event.id);
    return previousEntries[0] || null;
  }

  /**
   * Check if a tool has been called before with different output
   */
  function hasPreviousOutput(event: HookEvent): boolean {
    const previous = getPreviousOutput(event);
    return previous !== null;
  }

  /**
   * Compare current and previous outputs, returning diff info
   */
  function getDiffInfo(event: HookEvent): DiffInfo | null {
    if (event.hook_event_type !== 'PostToolUse') return null;

    const previous = getPreviousOutput(event);
    if (!previous) return null;

    const currentOutput = event.payload.tool_output ?? event.payload.tool_result;

    return computeDiff(previous.output, currentOutput, previous.timestamp);
  }

  /**
   * Clear all history (useful for testing)
   */
  function clearHistory(): void {
    Object.keys(toolOutputStore).forEach(key => {
      delete toolOutputStore[key];
    });
  }

  return {
    recordToolOutput,
    getPreviousOutput,
    hasPreviousOutput,
    getDiffInfo,
    clearHistory
  };
}

// Diff result interface
export interface DiffInfo {
  hasChanges: boolean;
  previousTimestamp: number;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  addedFields: string[];
  removedFields: string[];
  modifiedFields: string[];
  previousValue: unknown;
  currentValue: unknown;
  summary: string;
}

/**
 * Compute diff between two values
 */
function computeDiff(previous: unknown, current: unknown, previousTimestamp: number): DiffInfo {
  const addedFields: string[] = [];
  const removedFields: string[] = [];
  const modifiedFields: string[] = [];

  // Handle null/undefined
  if (previous === null || previous === undefined) {
    if (current === null || current === undefined) {
      return {
        hasChanges: false,
        previousTimestamp,
        changeType: 'unchanged',
        addedFields: [],
        removedFields: [],
        modifiedFields: [],
        previousValue: previous,
        currentValue: current,
        summary: 'No changes'
      };
    }
    return {
      hasChanges: true,
      previousTimestamp,
      changeType: 'added',
      addedFields: ['*'],
      removedFields: [],
      modifiedFields: [],
      previousValue: previous,
      currentValue: current,
      summary: 'Output added'
    };
  }

  if (current === null || current === undefined) {
    return {
      hasChanges: true,
      previousTimestamp,
      changeType: 'removed',
      addedFields: [],
      removedFields: ['*'],
      modifiedFields: [],
      previousValue: previous,
      currentValue: current,
      summary: 'Output removed'
    };
  }

  // Handle primitive values
  if (typeof previous !== 'object' || typeof current !== 'object') {
    const changed = previous !== current;
    return {
      hasChanges: changed,
      previousTimestamp,
      changeType: changed ? 'modified' : 'unchanged',
      addedFields: [],
      removedFields: [],
      modifiedFields: changed ? ['value'] : [],
      previousValue: previous,
      currentValue: current,
      summary: changed ? 'Value changed' : 'No changes'
    };
  }

  // Handle arrays
  if (Array.isArray(previous) && Array.isArray(current)) {
    const changed = JSON.stringify(previous) !== JSON.stringify(current);
    const lenDiff = current.length - previous.length;
    let summary = 'No changes';
    if (lenDiff > 0) {
      summary = `${lenDiff} item(s) added`;
    } else if (lenDiff < 0) {
      summary = `${Math.abs(lenDiff)} item(s) removed`;
    } else if (changed) {
      summary = 'Items modified';
    }
    return {
      hasChanges: changed,
      previousTimestamp,
      changeType: changed ? 'modified' : 'unchanged',
      addedFields: lenDiff > 0 ? [`+${lenDiff} items`] : [],
      removedFields: lenDiff < 0 ? [`-${Math.abs(lenDiff)} items`] : [],
      modifiedFields: changed && lenDiff === 0 ? ['array content'] : [],
      previousValue: previous,
      currentValue: current,
      summary
    };
  }

  // Handle objects
  const prevObj = previous as Record<string, unknown>;
  const currObj = current as Record<string, unknown>;
  const prevKeys = new Set(Object.keys(prevObj));
  const currKeys = new Set(Object.keys(currObj));

  // Find added fields
  currKeys.forEach(key => {
    if (!prevKeys.has(key)) {
      addedFields.push(key);
    }
  });

  // Find removed fields
  prevKeys.forEach(key => {
    if (!currKeys.has(key)) {
      removedFields.push(key);
    }
  });

  // Find modified fields
  prevKeys.forEach(key => {
    if (currKeys.has(key)) {
      if (JSON.stringify(prevObj[key]) !== JSON.stringify(currObj[key])) {
        modifiedFields.push(key);
      }
    }
  });

  const hasChanges = addedFields.length > 0 || removedFields.length > 0 || modifiedFields.length > 0;

  let changeType: DiffInfo['changeType'] = 'unchanged';
  if (hasChanges) {
    if (removedFields.length > 0 && addedFields.length === 0) {
      changeType = 'removed';
    } else if (addedFields.length > 0 && removedFields.length === 0) {
      changeType = 'added';
    } else {
      changeType = 'modified';
    }
  }

  // Generate summary
  const parts: string[] = [];
  if (addedFields.length > 0) parts.push(`+${addedFields.length} added`);
  if (removedFields.length > 0) parts.push(`-${removedFields.length} removed`);
  if (modifiedFields.length > 0) parts.push(`${modifiedFields.length} modified`);
  const summary = parts.length > 0 ? parts.join(', ') : 'No changes';

  return {
    hasChanges,
    previousTimestamp,
    changeType,
    addedFields,
    removedFields,
    modifiedFields,
    previousValue: previous,
    currentValue: current,
    summary
  };
}
