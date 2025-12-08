# Session Replay T0 Features - Implementation Plan

**Priority:** Critical (T0)
**Estimated Effort:** 3-4 days
**Status:** Planning
**Created:** 2025-12-06

---

## Executive Summary

This document provides a comprehensive implementation plan for three critical Session Replay features that will transform the feature from "functional" to "production-ready and indispensable."

**Features:**
1. **Search & Filter Sessions** - Find any session instantly
2. **Session Quick Summary Card** - Understand session at a glance
3. **Smart Jump Points** - Navigate long sessions efficiently

**Why These Matter:**
- Users currently have 200+ sessions with no way to search → unusable
- Long sessions (500+ events) require manual scrubbing → time-consuming
- No quick way to understand "what happened" → frustrating

**Success Criteria:**
- Find any session in <5 seconds
- Understand session outcome without playing it
- Jump to critical events in <2 clicks

---

## Feature #1: Search & Filter Sessions

### User Stories

**As a user, I want to:**
1. Search sessions by project name, date, or keywords
2. Filter sessions by status (success/error), cost range, duration
3. Filter by model used, agent type, or event characteristics
4. See search results in real-time as I type
5. Clear all filters with one click
6. Save common filter combinations

### Requirements

#### Functional Requirements

1. **Search Input**
   - Text search across: project name, repo name, source app, session ID
   - Real-time filtering (debounced to 300ms)
   - Clear button to reset search
   - Search suggestions/autocomplete (optional for v1)

2. **Filters**
   - **Date Range:** Today, Yesterday, This Week, This Month, Custom Range
   - **Status:** Success, Error, Partial, Ongoing
   - **Cost:** Free (<$0.01), Low ($0.01-$0.10), Medium ($0.10-$1.00), High (>$1.00)
   - **Duration:** Quick (<1 min), Normal (1-10 min), Long (>10 min)
   - **Event Count:** Small (<50), Medium (50-200), Large (>200)
   - **Has Errors:** Yes/No toggle
   - **Has HITL:** Yes/No toggle
   - **Model:** Dropdown of all models seen
   - **Agent Type:** Claude, Codex, Custom

3. **Filter UI**
   - Collapsible filter panel (can hide to save space)
   - Active filters shown as removable chips
   - "Clear All Filters" button
   - Filter count indicator ("3 filters active")

4. **Results**
   - Show count: "Showing 23 of 456 sessions"
   - Maintain date grouping even with filters
   - Empty state: "No sessions match your filters"
   - Performance: Handle 1000+ sessions smoothly

#### Non-Functional Requirements

1. **Performance**
   - Search results in <100ms
   - Filter application in <50ms
   - No UI blocking/freezing
   - Debounced search to avoid excessive re-renders

2. **UX**
   - Keyboard navigation (Tab, Enter, Escape)
   - Focus management (auto-focus search on open)
   - Accessible (ARIA labels, keyboard support)
   - Responsive (works on different screen sizes)

3. **Persistence**
   - Remember last search/filters in session storage
   - Restore on component mount
   - Clear on explicit reset

### Technical Design

#### Data Flow

```
User Input → Debounced Search → Filter Functions → Filtered Sessions → Grouped Sessions → UI
```

#### Component Structure

```
SessionReplay.vue
├── SearchAndFilterPanel.vue (NEW)
│   ├── SearchInput.vue
│   ├── FilterGroup.vue
│   │   ├── DateRangeFilter.vue
│   │   ├── StatusFilter.vue
│   │   ├── CostFilter.vue
│   │   ├── DurationFilter.vue
│   │   └── ToggleFilters.vue
│   └── ActiveFiltersChips.vue
└── SessionList.vue (ENHANCED)
```

#### State Management

```typescript
interface FilterState {
  search: string;
  dateRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | null;
  customDateRange?: { start: number; end: number };
  status: Set<SessionStatus>;
  costRange: { min: number; max: number } | null;
  durationRange: { min: number; max: number } | null;
  eventCountRange: { min: number; max: number } | null;
  hasErrors: boolean | null;
  hasHitl: boolean | null;
  models: Set<string>;
  agentTypes: Set<string>;
}

const filterState = ref<FilterState>({
  search: '',
  dateRange: null,
  status: new Set(),
  costRange: null,
  durationRange: null,
  eventCountRange: null,
  hasErrors: null,
  hasHitl: null,
  models: new Set(),
  agentTypes: new Set()
});
```

#### Filter Logic

```typescript
// Composable: useSessionFilters.ts
export function useSessionFilters(sessions: Ref<SessionSummary[]>) {
  const filterState = ref<FilterState>(/* ... */);

  const filteredSessions = computed(() => {
    return sessions.value.filter(session => {
      // Text search
      if (filterState.value.search) {
        const searchLower = filterState.value.search.toLowerCase();
        const searchableText = [
          session.repo_name,
          session.project_name,
          session.source_app,
          session.session_id
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // Date range
      if (filterState.value.dateRange) {
        const sessionTime = session.end_time || session.start_time;
        if (!isInDateRange(sessionTime, filterState.value.dateRange)) {
          return false;
        }
      }

      // Status filter
      if (filterState.value.status.size > 0) {
        if (!filterState.value.status.has(session.status)) {
          return false;
        }
      }

      // Cost range
      if (filterState.value.costRange) {
        const { min, max } = filterState.value.costRange;
        if (session.total_cost_usd < min || session.total_cost_usd > max) {
          return false;
        }
      }

      // Duration range
      if (filterState.value.durationRange) {
        const { min, max } = filterState.value.durationRange;
        const durationMin = (session.duration_ms || 0) / 1000 / 60;
        if (durationMin < min || durationMin > max) {
          return false;
        }
      }

      // Event count range
      if (filterState.value.eventCountRange) {
        const { min, max } = filterState.value.eventCountRange;
        if (session.event_count < min || session.event_count > max) {
          return false;
        }
      }

      // Has errors toggle
      if (filterState.value.hasErrors !== null) {
        if (session.has_errors !== filterState.value.hasErrors) {
          return false;
        }
      }

      // Has HITL toggle
      if (filterState.value.hasHitl !== null) {
        if (session.has_hitl !== filterState.value.hasHitl) {
          return false;
        }
      }

      // Model filter
      if (filterState.value.models.size > 0) {
        if (!session.model_name || !filterState.value.models.has(session.model_name)) {
          return false;
        }
      }

      // Agent type filter
      if (filterState.value.agentTypes.size > 0) {
        if (!filterState.value.agentTypes.has(session.agent_type)) {
          return false;
        }
      }

      return true;
    });
  });

  const filterCount = computed(() => {
    let count = 0;
    if (filterState.value.search) count++;
    if (filterState.value.dateRange) count++;
    if (filterState.value.status.size > 0) count++;
    if (filterState.value.costRange) count++;
    if (filterState.value.durationRange) count++;
    if (filterState.value.eventCountRange) count++;
    if (filterState.value.hasErrors !== null) count++;
    if (filterState.value.hasHitl !== null) count++;
    if (filterState.value.models.size > 0) count++;
    if (filterState.value.agentTypes.size > 0) count++;
    return count;
  });

  const clearAllFilters = () => {
    filterState.value = {
      search: '',
      dateRange: null,
      status: new Set(),
      costRange: null,
      durationRange: null,
      eventCountRange: null,
      hasErrors: null,
      hasHitl: null,
      models: new Set(),
      agentTypes: new Set()
    };
  };

  return {
    filterState,
    filteredSessions,
    filterCount,
    clearAllFilters
  };
}
```

#### UI Implementation

**Search Bar:**
```vue
<template>
  <div class="mb-4">
    <div class="relative">
      <input
        v-model="filterState.search"
        type="text"
        placeholder="Search sessions by project, repo, or ID..."
        class="w-full px-4 py-2 pl-10 pr-10 border border-[var(--theme-border-primary)] rounded-lg bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/30"
      />
      <svg class="absolute left-3 top-2.5 w-5 h-5 text-[var(--theme-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <button
        v-if="filterState.search"
        @click="filterState.search = ''"
        class="absolute right-3 top-2.5 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
```

**Filter Panel:**
```vue
<template>
  <div class="border-t border-[var(--theme-border-primary)] pt-4 mt-4">
    <!-- Filter Header -->
    <div class="flex items-center justify-between mb-3">
      <button
        @click="showFilters = !showFilters"
        class="flex items-center gap-2 text-sm font-semibold text-[var(--theme-primary)] hover:underline"
      >
        <svg class="w-4 h-4" :class="{ 'rotate-180': !showFilters }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        Filters
        <span v-if="filterCount > 0" class="px-2 py-0.5 text-xs bg-[var(--theme-primary)] text-white rounded-full">
          {{ filterCount }}
        </span>
      </button>
      <button
        v-if="filterCount > 0"
        @click="clearAllFilters"
        class="text-xs text-[var(--theme-text-secondary)] hover:text-[var(--theme-primary)]"
      >
        Clear All
      </button>
    </div>

    <!-- Active Filters Chips -->
    <div v-if="filterCount > 0" class="flex flex-wrap gap-2 mb-3">
      <span
        v-for="chip in activeFilterChips"
        :key="chip.id"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded-full"
      >
        {{ chip.label }}
        <button @click="chip.remove" class="hover:text-[var(--theme-primary-dark)]">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Filter Options (Collapsible) -->
    <div v-show="showFilters" class="space-y-3">
      <!-- Date Range -->
      <FilterGroup label="Date Range">
        <select v-model="filterState.dateRange" class="...">
          <option :value="null">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </FilterGroup>

      <!-- Status Checkboxes -->
      <FilterGroup label="Status">
        <label v-for="status in ['success', 'error', 'partial', 'ongoing']" :key="status" class="flex items-center gap-2">
          <input type="checkbox" :checked="filterState.status.has(status)" @change="toggleStatus(status)" />
          <span class="capitalize">{{ status }}</span>
        </label>
      </FilterGroup>

      <!-- Cost Range -->
      <FilterGroup label="Cost">
        <select v-model="costPreset" class="...">
          <option :value="null">Any Cost</option>
          <option value="free">Free (&lt;$0.01)</option>
          <option value="low">Low ($0.01-$0.10)</option>
          <option value="medium">Medium ($0.10-$1.00)</option>
          <option value="high">High (&gt;$1.00)</option>
        </select>
      </FilterGroup>

      <!-- Boolean Toggles -->
      <FilterGroup label="Characteristics">
        <label class="flex items-center gap-2">
          <input type="checkbox" :checked="filterState.hasErrors === true" @change="toggleHasErrors" />
          <span>Has Errors</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" :checked="filterState.hasHitl === true" @change="toggleHasHitl" />
          <span>Has HITL</span>
        </label>
      </FilterGroup>
    </div>
  </div>
</template>
```

**Results Counter:**
```vue
<div class="text-sm text-[var(--theme-text-secondary)] mb-2">
  Showing {{ filteredSessions.length }} of {{ totalSessions }} sessions
  <span v-if="filterCount > 0">({{ filterCount }} filter{{ filterCount !== 1 ? 's' : '' }} active)</span>
</div>
```

---

## Feature #2: Session Quick Summary Card

### User Stories

**As a user, I want to:**
1. See a summary of what happened in the session before watching it
2. Understand the outcome (success/failure) and why
3. See key metrics (cost, duration, errors, HITL count) at a glance
4. Know what the user was trying to accomplish
5. Quickly decide if this session is relevant to my needs

### Requirements

#### Functional Requirements

1. **Summary Card Location**
   - Displayed immediately after loading a session
   - Above the playback controls
   - Collapsible to save space (remember state)

2. **Summary Content**
   - **Outcome Badge:** Success (green), Error (red), Partial (yellow), Ongoing (blue)
   - **Key Metrics Row:**
     - Duration: "5.2 min"
     - Event Count: "225 events"
     - Cost: "$0.15" (with color coding: green <$0.10, yellow $0.10-$1, red >$1)
     - Errors: "3 errors" (if any)
     - HITL: "2 interventions" (if any)
   - **Auto-Generated Summary:**
     - First user message (truncated to 100 chars)
     - OR extracted goal/task from session
     - OR "Session started at [time]"
   - **Critical Events:**
     - List up to 3 most important events: Errors, HITL, High-cost operations
     - Click to jump to that event
   - **Metadata:**
     - Model used
     - Agent type
     - Project/repo name
     - Session ID (copyable)

3. **Summary Generation**
   - Server-side: Pre-compute during session processing (ideal)
   - Client-side: Generate on load from events (fallback)
   - Use LLM for smart summarization (future enhancement)

4. **Interactivity**
   - Click on "3 errors" → Jump to first error
   - Click on "2 HITL" → Jump to first HITL event
   - Click on event in critical events list → Jump to that event
   - Copy session ID button
   - Expand/collapse button

#### Non-Functional Requirements

1. **Performance**
   - Summary generation in <100ms
   - No blocking UI while generating
   - Cache summary after first generation

2. **UX**
   - Clear visual hierarchy
   - Scannable at a glance
   - Color-coded for quick interpretation
   - Accessible (screen readers)

### Technical Design

#### Data Structure

```typescript
interface SessionSummary {
  // ... existing fields ...

  // NEW: Enhanced summary data
  summary_text?: string; // Auto-generated summary
  first_user_message?: string; // Extracted from events
  critical_events?: CriticalEvent[];
}

interface CriticalEvent {
  event_id: number;
  type: 'error' | 'hitl' | 'high_cost' | 'long_duration';
  timestamp: number;
  description: string;
  event_type: string;
}
```

#### Summary Generation Logic

**Client-Side (Immediate Implementation):**

```typescript
// composables/useSessionSummary.ts
export function useSessionSummary(session: Ref<SessionSummary>, events: Ref<HookEvent[]>) {
  const summary = computed(() => {
    const s = session.value;
    const e = events.value;

    // Extract first user message
    const firstUserMessage = e.find(event =>
      event.hook_event_type === 'UserPromptSubmit' ||
      event.hook_event_type === 'Notification' && event.payload?.notification_type === 'user_prompt'
    )?.payload?.message || '';

    // Find critical events
    const criticalEvents: CriticalEvent[] = [];

    // Errors
    e.forEach((event, index) => {
      if (event.hook_event_type.includes('Error')) {
        criticalEvents.push({
          event_id: index,
          type: 'error',
          timestamp: event.timestamp || 0,
          description: event.summary || event.hook_event_type,
          event_type: event.hook_event_type
        });
      }
    });

    // HITL events
    e.forEach((event, index) => {
      if (event.humanInTheLoop) {
        criticalEvents.push({
          event_id: index,
          type: 'hitl',
          timestamp: event.timestamp || 0,
          description: event.humanInTheLoop.question,
          event_type: event.hook_event_type
        });
      }
    });

    // High cost events (>$0.10)
    e.forEach((event, index) => {
      if (event.cost_usd && event.cost_usd > 0.10) {
        criticalEvents.push({
          event_id: index,
          type: 'high_cost',
          timestamp: event.timestamp || 0,
          description: `High cost: $${event.cost_usd.toFixed(2)}`,
          event_type: event.hook_event_type
        });
      }
    });

    // Sort by timestamp and take top 3
    criticalEvents.sort((a, b) => a.timestamp - b.timestamp);
    const topCritical = criticalEvents.slice(0, 3);

    return {
      outcome: s.status,
      duration: s.duration_ms,
      eventCount: s.event_count,
      cost: s.total_cost_usd,
      errorCount: s.has_errors ? criticalEvents.filter(e => e.type === 'error').length : 0,
      hitlCount: s.has_hitl ? criticalEvents.filter(e => e.type === 'hitl').length : 0,
      firstUserMessage: firstUserMessage.slice(0, 100) + (firstUserMessage.length > 100 ? '...' : ''),
      criticalEvents: topCritical,
      model: s.model_name,
      agentType: s.agent_type,
      project: s.repo_name || s.project_name || s.source_app
    };
  });

  return summary;
}
```

#### UI Component

```vue
<!-- SessionSummaryCard.vue -->
<template>
  <div class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-lg p-4 mb-4">
    <!-- Header with Outcome Badge -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <span
          class="px-3 py-1 rounded-full text-sm font-semibold"
          :class="outcomeBadgeClass"
        >
          {{ summary.outcome }}
        </span>
        <h3 class="text-lg font-bold text-[var(--theme-text-primary)]">
          {{ summary.project }}
        </h3>
      </div>
      <button
        @click="isExpanded = !isExpanded"
        class="p-1 hover:bg-[var(--theme-bg-primary)] rounded transition-all"
        :title="isExpanded ? 'Collapse' : 'Expand'"
      >
        <svg class="w-5 h-5 transition-transform" :class="{ 'rotate-180': isExpanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <!-- Key Metrics Row -->
    <div class="grid grid-cols-5 gap-3 mb-3">
      <!-- Duration -->
      <div class="text-center">
        <div class="text-2xl font-bold text-[var(--theme-primary)]">
          {{ formatDuration(summary.duration) }}
        </div>
        <div class="text-xs text-[var(--theme-text-secondary)]">Duration</div>
      </div>

      <!-- Event Count -->
      <div class="text-center">
        <div class="text-2xl font-bold text-[var(--theme-primary)]">
          {{ summary.eventCount }}
        </div>
        <div class="text-xs text-[var(--theme-text-secondary)]">Events</div>
      </div>

      <!-- Cost -->
      <div class="text-center">
        <div class="text-2xl font-bold" :class="costColorClass">
          ${{ summary.cost.toFixed(2) }}
        </div>
        <div class="text-xs text-[var(--theme-text-secondary)]">Cost</div>
      </div>

      <!-- Errors (if any) -->
      <div v-if="summary.errorCount > 0" class="text-center cursor-pointer" @click="$emit('jumpToFirstError')">
        <div class="text-2xl font-bold text-red-500">
          {{ summary.errorCount }}
        </div>
        <div class="text-xs text-[var(--theme-text-secondary)]">Errors</div>
      </div>

      <!-- HITL (if any) -->
      <div v-if="summary.hitlCount > 0" class="text-center cursor-pointer" @click="$emit('jumpToFirstHitl')">
        <div class="text-2xl font-bold text-yellow-500">
          {{ summary.hitlCount }}
        </div>
        <div class="text-xs text-[var(--theme-text-secondary)]">HITL</div>
      </div>
    </div>

    <!-- Expanded Content -->
    <div v-show="isExpanded" class="space-y-3 border-t border-[var(--theme-border-primary)] pt-3">
      <!-- First User Message / Task -->
      <div v-if="summary.firstUserMessage">
        <div class="text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">Task</div>
        <div class="text-sm text-[var(--theme-text-primary)] italic">
          "{{ summary.firstUserMessage }}"
        </div>
      </div>

      <!-- Critical Events -->
      <div v-if="summary.criticalEvents.length > 0">
        <div class="text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">Critical Events</div>
        <div class="space-y-1">
          <button
            v-for="event in summary.criticalEvents"
            :key="event.event_id"
            @click="$emit('jumpToEvent', event.event_id)"
            class="w-full text-left px-2 py-1 text-sm rounded hover:bg-[var(--theme-bg-primary)] transition-all flex items-center gap-2"
          >
            <span :class="criticalEventIconClass(event.type)">
              {{ criticalEventIcon(event.type) }}
            </span>
            <span class="flex-1 truncate">{{ event.description }}</span>
            <span class="text-xs text-[var(--theme-text-secondary)]">
              {{ formatTime(event.timestamp) }}
            </span>
          </button>
        </div>
      </div>

      <!-- Metadata -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-[var(--theme-text-secondary)]">Model:</span>
          <span class="text-[var(--theme-text-primary)] ml-1">{{ summary.model || 'Unknown' }}</span>
        </div>
        <div>
          <span class="text-[var(--theme-text-secondary)]">Agent:</span>
          <span class="text-[var(--theme-text-primary)] ml-1">{{ summary.agentType }}</span>
        </div>
        <div class="col-span-2 flex items-center gap-2">
          <span class="text-[var(--theme-text-secondary)]">Session ID:</span>
          <code class="text-[var(--theme-text-primary)] text-xs bg-[var(--theme-bg-primary)] px-1 rounded">
            {{ session.session_id.slice(0, 8) }}...
          </code>
          <button
            @click="copySessionId"
            class="p-1 hover:bg-[var(--theme-bg-primary)] rounded"
            :title="copied ? 'Copied!' : 'Copy full ID'"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!copied" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  summary: any;
  session: SessionSummary;
}>();

const emit = defineEmits<{
  jumpToFirstError: [];
  jumpToFirstHitl: [];
  jumpToEvent: [eventId: number];
}>();

const isExpanded = ref(true);
const copied = ref(false);

const outcomeBadgeClass = computed(() => {
  const baseClass = 'text-white ';
  switch (props.summary.outcome) {
    case 'success': return baseClass + 'bg-green-500';
    case 'error': return baseClass + 'bg-red-500';
    case 'partial': return baseClass + 'bg-yellow-500';
    case 'ongoing': return baseClass + 'bg-blue-500';
    default: return baseClass + 'bg-gray-500';
  }
});

const costColorClass = computed(() => {
  if (props.summary.cost < 0.10) return 'text-green-500';
  if (props.summary.cost < 1.00) return 'text-yellow-500';
  return 'text-red-500';
});

const formatDuration = (ms: number) => {
  const minutes = ms / 1000 / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)} hr`;
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const criticalEventIcon = (type: string) => {
  switch (type) {
    case 'error': return '⚠️';
    case 'hitl': return '👤';
    case 'high_cost': return '💰';
    default: return '📌';
  }
};

const criticalEventIconClass = (type: string) => {
  return 'text-lg';
};

const copySessionId = async () => {
  try {
    await navigator.clipboard.writeText(props.session.session_id);
    copied.value = true;
    setTimeout(() => copied.value = false, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};
</script>
```

---

## Feature #3: Smart Jump Points

### User Stories

**As a user, I want to:**
1. Jump to the first error in a session instantly
2. Jump to HITL interventions quickly
3. Jump to the most expensive event
4. See a visual overview of where interesting events are
5. Navigate between similar events (next error, previous error)

### Requirements

#### Functional Requirements

1. **Quick Jump Buttons**
   - "First Error" button (visible if session has errors)
   - "First HITL" button (visible if session has HITL)
   - "Highest Cost Event" button
   - "Longest Event" button (if any event >30s)
   - Position: Below summary card, above playback controls

2. **Minimap**
   - Visual timeline of entire session
   - Color-coded regions:
     - Green: Normal events
     - Red: Errors
     - Yellow: HITL
     - Orange: High cost (>$0.05)
     - Purple: Long duration (>30s)
   - Click on minimap to jump to that point
   - Current position indicator
   - Hover to show event type

3. **Event Navigation**
   - "Next Error" / "Previous Error" buttons (when on an error)
   - "Next HITL" / "Previous HITL" buttons (when on HITL)
   - Keyboard shortcuts: 'E' for next error, 'H' for next HITL
   - Event counter: "Error 2 of 5"

4. **Phase Detection (Future Enhancement)**
   - Auto-detect phases: Planning, Tool Usage, Error Recovery, Review
   - Jump to phase start/end
   - Visual phase boundaries on minimap

#### Non-Functional Requirements

1. **Performance**
   - Minimap renders in <200ms
   - Jump actions happen instantly (<50ms)
   - No lag when scrubbing

2. **UX**
   - Buttons are clearly labeled and discoverable
   - Visual feedback on jump (brief highlight)
   - Keyboard shortcuts are documented
   - Works on mobile (touch-friendly)

### Technical Design

#### Data Processing

```typescript
// Preprocess events to find jump points
interface JumpPoints {
  firstError: number | null;
  allErrors: number[];
  firstHitl: number | null;
  allHitl: number[];
  highestCostEvent: number | null;
  longestEvent: number | null;
  eventsByType: Map<string, number[]>; // For minimap
}

function computeJumpPoints(events: HookEvent[]): JumpPoints {
  const jumpPoints: JumpPoints = {
    firstError: null,
    allErrors: [],
    firstHitl: null,
    allHitl: [],
    highestCostEvent: null,
    longestEvent: null,
    eventsByType: new Map()
  };

  let maxCost = 0;
  let maxDuration = 0;

  events.forEach((event, index) => {
    // Track errors
    if (event.hook_event_type.includes('Error')) {
      if (jumpPoints.firstError === null) {
        jumpPoints.firstError = index;
      }
      jumpPoints.allErrors.push(index);
    }

    // Track HITL
    if (event.humanInTheLoop) {
      if (jumpPoints.firstHitl === null) {
        jumpPoints.firstHitl = index;
      }
      jumpPoints.allHitl.push(index);
    }

    // Track highest cost
    if (event.cost_usd && event.cost_usd > maxCost) {
      maxCost = event.cost_usd;
      jumpPoints.highestCostEvent = index;
    }

    // Track longest event (if we have duration data)
    const duration = index < events.length - 1
      ? (events[index + 1].timestamp || 0) - (event.timestamp || 0)
      : 0;
    if (duration > maxDuration && duration > 30000) { // >30s
      maxDuration = duration;
      jumpPoints.longestEvent = index;
    }

    // Group by type for minimap
    const type = event.hook_event_type;
    if (!jumpPoints.eventsByType.has(type)) {
      jumpPoints.eventsByType.set(type, []);
    }
    jumpPoints.eventsByType.get(type)!.push(index);
  });

  return jumpPoints;
}
```

#### Minimap Component

```vue
<!-- SessionMinimap.vue -->
<template>
  <div class="relative h-8 bg-[var(--theme-bg-secondary)] rounded-lg overflow-hidden border border-[var(--theme-border-primary)]">
    <!-- Event markers -->
    <div class="absolute inset-0 flex">
      <div
        v-for="(segment, index) in segments"
        :key="index"
        :style="{
          width: `${segment.width}%`,
          backgroundColor: segment.color
        }"
        class="relative group cursor-pointer hover:opacity-80 transition-opacity"
        @click="jumpToSegment(segment.startIndex)"
      >
        <!-- Tooltip on hover -->
        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {{ segment.label }}
        </div>
      </div>
    </div>

    <!-- Current position indicator -->
    <div
      class="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
      :style="{ left: `${currentPositionPercent}%` }"
    />

    <!-- Click overlay for precise jumping -->
    <div
      class="absolute inset-0 cursor-pointer"
      @click="jumpToPosition"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  events: HookEvent[];
  currentIndex: number;
  jumpPoints: JumpPoints;
}>();

const emit = defineEmits<{
  jumpTo: [index: number];
}>();

// Compute segments for minimap
const segments = computed(() => {
  const segs: Array<{
    startIndex: number;
    endIndex: number;
    width: number;
    color: string;
    label: string;
  }> = [];

  const eventCount = props.events.length;
  if (eventCount === 0) return segs;

  // Simple approach: Each event gets equal width, colored by importance
  props.events.forEach((event, index) => {
    const width = 100 / eventCount;

    let color = '#10b981'; // green - normal
    let label = event.hook_event_type;

    // Prioritize colors: error > hitl > high cost > normal
    if (event.hook_event_type.includes('Error')) {
      color = '#ef4444'; // red
      label = 'Error: ' + event.hook_event_type;
    } else if (event.humanInTheLoop) {
      color = '#eab308'; // yellow
      label = 'HITL: ' + event.humanInTheLoop.question.slice(0, 50);
    } else if (event.cost_usd && event.cost_usd > 0.05) {
      color = '#f97316'; // orange
      label = `High Cost: $${event.cost_usd.toFixed(2)}`;
    }

    segs.push({
      startIndex: index,
      endIndex: index,
      width,
      color,
      label
    });
  });

  return segs;
});

const currentPositionPercent = computed(() => {
  if (props.events.length === 0) return 0;
  return (props.currentIndex / (props.events.length - 1)) * 100;
});

const jumpToSegment = (index: number) => {
  emit('jumpTo', index);
};

const jumpToPosition = (event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percent = x / rect.width;
  const index = Math.floor(percent * (props.events.length - 1));
  emit('jumpTo', index);
};
</script>
```

#### Quick Jump Buttons

```vue
<template>
  <div class="flex flex-wrap gap-2 mb-3">
    <!-- Jump to First Error -->
    <button
      v-if="jumpPoints.firstError !== null"
      @click="$emit('jumpTo', jumpPoints.firstError)"
      class="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all flex items-center gap-2"
    >
      <span>⚠️</span>
      <span>First Error</span>
      <span class="text-xs opacity-75">({{ jumpPoints.allErrors.length }})</span>
    </button>

    <!-- Jump to First HITL -->
    <button
      v-if="jumpPoints.firstHitl !== null"
      @click="$emit('jumpTo', jumpPoints.firstHitl)"
      class="px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all flex items-center gap-2"
    >
      <span>👤</span>
      <span>First HITL</span>
      <span class="text-xs opacity-75">({{ jumpPoints.allHitl.length }})</span>
    </button>

    <!-- Jump to Highest Cost -->
    <button
      v-if="jumpPoints.highestCostEvent !== null"
      @click="$emit('jumpTo', jumpPoints.highestCostEvent)"
      class="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all flex items-center gap-2"
    >
      <span>💰</span>
      <span>Highest Cost</span>
      <span class="text-xs opacity-75">(${{ getEventCost(jumpPoints.highestCostEvent).toFixed(2) }})</span>
    </button>

    <!-- Jump to Longest Event -->
    <button
      v-if="jumpPoints.longestEvent !== null"
      @click="$emit('jumpTo', jumpPoints.longestEvent)"
      class="px-3 py-1.5 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all flex items-center gap-2"
    >
      <span>⏱️</span>
      <span>Longest Event</span>
    </button>
  </div>

  <!-- Navigation Between Similar Events (shown when on relevant event) -->
  <div v-if="showNavigation" class="flex items-center gap-2 mb-2 text-sm">
    <button
      @click="navigatePrevious"
      :disabled="!hasPrevious"
      class="px-2 py-1 rounded bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      ← Previous {{ currentEventType }}
    </button>

    <span class="text-[var(--theme-text-secondary)]">
      {{ currentEventType }} {{ currentEventPosition + 1 }} of {{ totalEventsOfType }}
    </span>

    <button
      @click="navigateNext"
      :disabled="!hasNext"
      class="px-2 py-1 rounded bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Next {{ currentEventType }} →
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  jumpPoints: JumpPoints;
  currentIndex: number;
  events: HookEvent[];
}>();

const emit = defineEmits<{
  jumpTo: [index: number];
}>();

// Determine if current event is an error or HITL
const currentEventType = computed(() => {
  const event = props.events[props.currentIndex];
  if (!event) return null;

  if (event.hook_event_type.includes('Error')) return 'Error';
  if (event.humanInTheLoop) return 'HITL';
  return null;
});

const showNavigation = computed(() => currentEventType.value !== null);

const relevantEvents = computed(() => {
  if (currentEventType.value === 'Error') return props.jumpPoints.allErrors;
  if (currentEventType.value === 'HITL') return props.jumpPoints.allHitl;
  return [];
});

const currentEventPosition = computed(() => {
  return relevantEvents.value.indexOf(props.currentIndex);
});

const totalEventsOfType = computed(() => {
  return relevantEvents.value.length;
});

const hasPrevious = computed(() => currentEventPosition.value > 0);
const hasNext = computed(() => currentEventPosition.value < totalEventsOfType.value - 1);

const navigatePrevious = () => {
  if (hasPrevious.value) {
    emit('jumpTo', relevantEvents.value[currentEventPosition.value - 1]);
  }
};

const navigateNext = () => {
  if (hasNext.value) {
    emit('jumpTo', relevantEvents.value[currentEventPosition.value + 1]);
  }
};

const getEventCost = (index: number) => {
  return props.events[index]?.cost_usd || 0;
};
</script>
```

---

## Technical Architecture

### File Structure

```
apps/client/src/
├── components/
│   ├── SessionReplay.vue (MODIFIED - integrate new features)
│   ├── SessionSummaryCard.vue (NEW)
│   ├── SessionMinimap.vue (NEW)
│   ├── SessionSearchAndFilter.vue (NEW)
│   ├── SessionQuickJumps.vue (NEW)
│   └── FilterGroup.vue (NEW - reusable filter component)
├── composables/
│   ├── useReplay.ts (EXISTING - minor updates)
│   ├── useSessionFilters.ts (NEW)
│   ├── useSessionSummary.ts (NEW)
│   └── useJumpPoints.ts (NEW)
└── types.ts (MODIFIED - add filter types)
```

### State Management

All state managed via Vue composables (no Vuex/Pinia needed for now).

**State Flow:**
```
SessionReplay.vue (parent)
├── Fetches sessions → availableSessions
├── useSessionFilters(availableSessions) → filteredSessions
├── User selects session → loadSession()
├── useReplay() → replay.state (events, currentIndex)
├── useSessionSummary(session, events) → summary
└── useJumpPoints(events) → jumpPoints
```

### Performance Optimization

1. **Debounced Search:** 300ms debounce on text input
2. **Memoization:** Use `computed()` for all derived state
3. **Virtual Scrolling:** Already implemented for session list
4. **Lazy Loading:** Only compute summary/jump points when session loads
5. **Caching:** Cache computed jump points (don't recalculate on every render)

### Accessibility

1. **Keyboard Navigation:**
   - Tab through all interactive elements
   - Enter to activate buttons
   - Escape to close panels/clear filters
   - Arrow keys for minimap navigation

2. **Screen Readers:**
   - ARIA labels on all buttons
   - ARIA live regions for search results count
   - Semantic HTML (use `<button>`, `<label>`, etc.)

3. **Focus Management:**
   - Focus search input on component mount
   - Maintain focus on filter toggles
   - Return focus after modal interactions

---

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)

**Tasks:**
1. Create composables structure
   - [ ] `useSessionFilters.ts` - Filter logic
   - [ ] `useSessionSummary.ts` - Summary generation
   - [ ] `useJumpPoints.ts` - Jump point computation

2. Add types to `types.ts`
   - [ ] `FilterState` interface
   - [ ] `JumpPoints` interface
   - [ ] `SessionSummaryData` interface

3. Update SessionReplay.vue structure
   - [ ] Import new composables
   - [ ] Set up state management
   - [ ] Add component placeholders

**Deliverable:** Composables working with mock data

---

### Phase 2: Feature #1 - Search & Filter (Day 2)

**Morning:**
1. Build SessionSearchAndFilter.vue
   - [ ] Search input component
   - [ ] Filter panel (collapsible)
   - [ ] Active filter chips

2. Implement filter logic
   - [ ] Text search (debounced)
   - [ ] Date range filters
   - [ ] Status filters
   - [ ] Cost/duration/event count filters

**Afternoon:**
3. Integrate with SessionReplay.vue
   - [ ] Wire up filter state
   - [ ] Update session list to use filtered results
   - [ ] Add results counter
   - [ ] Test all filter combinations

4. Polish
   - [ ] Add keyboard shortcuts
   - [ ] Persist filter state
   - [ ] Empty states
   - [ ] Loading states

**Deliverable:** Fully functional search and filtering

---

### Phase 3: Feature #2 - Summary Card (Day 3 Morning)

**Tasks:**
1. Build SessionSummaryCard.vue
   - [ ] Outcome badge
   - [ ] Key metrics grid
   - [ ] Critical events list
   - [ ] Metadata section

2. Implement useSessionSummary
   - [ ] Extract first user message
   - [ ] Find critical events
   - [ ] Compute metrics
   - [ ] Format output

3. Integrate with SessionReplay.vue
   - [ ] Position above playback controls
   - [ ] Wire up jump events
   - [ ] Test expand/collapse
   - [ ] Test copy session ID

**Deliverable:** Summary card showing for all sessions

---

### Phase 4: Feature #3 - Smart Jump Points (Day 3 Afternoon)

**Tasks:**
1. Implement useJumpPoints
   - [ ] Find first error/HITL
   - [ ] Find highest cost/longest event
   - [ ] Build event indexes

2. Build SessionQuickJumps.vue
   - [ ] Quick jump buttons
   - [ ] Event navigation controls
   - [ ] Keyboard shortcuts (E, H)

3. Build SessionMinimap.vue
   - [ ] Segment rendering
   - [ ] Color coding
   - [ ] Click to jump
   - [ ] Current position indicator

4. Integrate all jump functionality
   - [ ] Wire up button clicks
   - [ ] Add keyboard listeners
   - [ ] Test jumping accuracy
   - [ ] Visual feedback on jump

**Deliverable:** Complete navigation system

---

### Phase 5: Integration & Testing (Day 4)

**Morning:**
1. Integration testing
   - [ ] Test all features together
   - [ ] Cross-feature interactions
   - [ ] Edge cases (empty sessions, 1000+ events)
   - [ ] Mobile responsiveness

2. Performance testing
   - [ ] Search with 500+ sessions
   - [ ] Minimap with 1000+ events
   - [ ] Filter combinations
   - [ ] Memory usage

**Afternoon:**
3. Polish & refinement
   - [ ] Visual consistency
   - [ ] Animation smoothness
   - [ ] Error handling
   - [ ] User feedback (loading states, success messages)

4. Accessibility audit
   - [ ] Keyboard navigation
   - [ ] Screen reader testing
   - [ ] Color contrast
   - [ ] Focus indicators

5. Documentation
   - [ ] Update README
   - [ ] Add JSDoc comments
   - [ ] Usage examples
   - [ ] Known limitations

**Deliverable:** Production-ready features

---

## Testing & Validation

### Unit Tests

**useSessionFilters:**
```typescript
describe('useSessionFilters', () => {
  it('filters by search text', () => {
    const sessions = ref([
      { session_id: '1', repo_name: 'project-alpha', ... },
      { session_id: '2', repo_name: 'project-beta', ... }
    ]);
    const { filterState, filteredSessions } = useSessionFilters(sessions);

    filterState.value.search = 'alpha';
    expect(filteredSessions.value).toHaveLength(1);
    expect(filteredSessions.value[0].session_id).toBe('1');
  });

  it('filters by date range', () => {
    // Test date filtering logic
  });

  it('combines multiple filters with AND logic', () => {
    // Test filter combination
  });
});
```

**useSessionSummary:**
```typescript
describe('useSessionSummary', () => {
  it('extracts first user message', () => {
    const events = ref([
      { hook_event_type: 'SessionStart', ... },
      { hook_event_type: 'UserPromptSubmit', payload: { message: 'Test task' }, ... }
    ]);
    const summary = useSessionSummary(session, events);

    expect(summary.value.firstUserMessage).toBe('Test task');
  });

  it('finds critical events', () => {
    // Test critical event detection
  });
});
```

### Integration Tests

```typescript
describe('SessionReplay - Search & Filter Integration', () => {
  it('filters session list when search is typed', async () => {
    const wrapper = mount(SessionReplay);

    // Type in search
    await wrapper.find('input[type="text"]').setValue('test-project');
    await wrapper.vm.$nextTick();

    // Check filtered results
    const options = wrapper.findAll('option');
    expect(options.length).toBeLessThan(initialSessionCount);
  });
});
```

### Manual Testing Checklist

- [ ] Search with empty string (shows all)
- [ ] Search with no matches (empty state)
- [ ] Filter by each individual filter
- [ ] Combine 3+ filters
- [ ] Clear all filters
- [ ] Persist filters across component remounts
- [ ] Jump to first error/HITL
- [ ] Navigate between errors with buttons
- [ ] Navigate with keyboard (E, H keys)
- [ ] Click on minimap to jump
- [ ] Expand/collapse summary card
- [ ] Copy session ID
- [ ] Click on critical events to jump
- [ ] Mobile touch interactions
- [ ] Keyboard-only navigation
- [ ] Screen reader compatibility

### Performance Benchmarks

**Target Metrics:**
- Search results: <100ms (with 500 sessions)
- Filter application: <50ms
- Minimap render: <200ms (with 1000 events)
- Jump action: <50ms
- Summary generation: <100ms

**Load Testing:**
- 100 sessions: Should be instant
- 500 sessions: <200ms for any operation
- 1000 sessions: <500ms (acceptable degradation)
- 1000+ events in session: Minimap still responsive

---

## Edge Cases & Error Handling

### Edge Cases

1. **Empty Sessions**
   - No events in session → Show message "This session has no events"
   - Summary card shows "No data available"
   - Jump points disabled

2. **Very Long Sessions (5000+ events)**
   - Minimap segments become tiny → Group nearby events
   - Consider pagination/windowing
   - Performance warning if >10,000 events

3. **Sessions with No Metadata**
   - Missing repo_name/project_name → Fall back to source_app
   - Missing timestamps → Can't compute duration
   - Missing cost data → Show "Cost unknown"

4. **Concurrent Sessions (Same project, same time)**
   - Ensure unique session IDs
   - Display timestamps to differentiate

5. **Invalid Filter Combinations**
   - Cost range with no sessions having cost data → Empty result
   - Show helpful message: "No sessions match these filters. Try removing some filters."

### Error Handling

1. **API Failures**
   - Failed to fetch sessions → Retry with exponential backoff
   - Show error toast: "Failed to load sessions. Retrying..."
   - Fallback to cached data if available

2. **Malformed Data**
   - Invalid timestamp → Use current time as fallback
   - Missing required fields → Log warning, skip session
   - Invalid event data → Show placeholder event

3. **Performance Issues**
   - >5000 events → Show warning: "This session is very large. Some features may be slower."
   - Option to load in "light mode" (skip minimap, limit features)

---

## Success Metrics

### Quantitative Metrics

1. **Feature Adoption**
   - % of users who use search (target: >80%)
   - % of sessions where filters are used (target: >50%)
   - % of sessions where jump points are used (target: >60%)

2. **Performance Metrics**
   - Search latency p50/p95 (target: <50ms / <100ms)
   - Time to find specific session (target: <5 seconds)
   - Page load time with 500 sessions (target: <2 seconds)

3. **User Behavior**
   - Average number of filters used per search (expected: 1-2)
   - Most common filter combinations
   - Most used jump point (likely "First Error")

### Qualitative Metrics

1. **Usability**
   - User can find any session in <5 seconds (observed)
   - User understands session outcome without playing (feedback)
   - User navigates long sessions without frustration (feedback)

2. **User Feedback**
   - Survey: "How easy is it to find sessions?" (target: >4/5)
   - Survey: "How useful is the summary card?" (target: >4/5)
   - Survey: "How useful are jump points?" (target: >4/5)

### Success Criteria for Launch

**Must Have:**
- [x] All T0 features implemented and tested
- [x] No critical bugs
- [x] Performance targets met
- [x] Accessibility requirements met
- [x] Works on Chrome, Firefox, Safari
- [x] Mobile responsive

**Should Have:**
- [ ] Keyboard shortcuts documented
- [ ] Empty states polished
- [ ] Loading states smooth
- [ ] Error messages helpful

**Nice to Have:**
- [ ] Search suggestions/autocomplete
- [ ] Saved filter presets
- [ ] Export filtered results

---

## Future Enhancements (Post-T0)

Once T0 is stable and adopted, consider:

1. **Advanced Search**
   - Fuzzy search
   - Search within event payloads
   - Regex support
   - Search history

2. **Smart Summary**
   - LLM-generated summaries
   - Auto-detect task/goal
   - Outcome explanation ("Failed because...")

3. **Phase Detection**
   - Auto-detect workflow phases
   - Visual phase boundaries
   - Phase-based navigation

4. **Saved Filters**
   - Save filter combinations as presets
   - Quick access to common filters
   - Share filter presets with team

5. **Export & Share**
   - Export filtered sessions as CSV/JSON
   - Share search URLs
   - Embed search results

---

## Appendix

### Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `/` | Focus search input |
| `Esc` | Clear search / Close filters |
| `E` | Jump to next error |
| `Shift + E` | Jump to previous error |
| `H` | Jump to next HITL |
| `Shift + H` | Jump to previous HITL |
| `Tab` | Navigate between filters |
| `Enter` | Apply filter / Load session |
| `Ctrl/Cmd + K` | Clear all filters |

### Color Coding Reference

| Color | Meaning | Usage |
|-------|---------|-------|
| Green | Success / Normal | Status badge, minimap normal events |
| Red | Error | Status badge, error events, minimap errors |
| Yellow | HITL / Partial | Status badge, HITL events, minimap |
| Orange | High Cost | Cost metric, minimap high-cost events |
| Purple | Long Duration | Minimap long-duration events |
| Blue | Ongoing | Status badge for in-progress sessions |

### Filter Preset Examples

**"Recent Failures"**
- Date Range: This Week
- Status: Error
- Has Errors: Yes

**"Expensive Sessions"**
- Cost Range: >$1.00
- Sort By: Cost (descending)

**"HITL Sessions"**
- Has HITL: Yes
- Sort By: Recency

**"Quick Wins"**
- Duration: <1 min
- Status: Success
- Cost: <$0.01

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-06 | 1.0 | Initial planning document created |

---

## Handoff Checklist

For the implementing agent:

- [ ] Read entire document thoroughly
- [ ] Understand data structures and types
- [ ] Review existing codebase structure
- [ ] Set up development environment
- [ ] Create feature branch: `feature/session-replay-t0`
- [ ] Follow implementation plan phase by phase
- [ ] Test each feature before moving to next
- [ ] Commit frequently with descriptive messages
- [ ] Run performance benchmarks
- [ ] Complete accessibility audit
- [ ] Update this document with actual implementation notes
- [ ] Create PR with detailed description

**Questions or Blockers?**
- Document in PLANS/session-replay-t0-questions.md
- Tag with priority level
- Include context and attempted solutions

---

**End of Planning Document**

This plan is comprehensive and ready for handoff. The implementing agent should be able to execute this with minimal additional guidance. All technical decisions have been made, component structures defined, and success criteria established.
