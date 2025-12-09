<template>
  <div class="h-screen flex flex-col bg-[var(--theme-bg-secondary)]">
    <!-- Header with Primary Theme Colors -->
    <header class="short:hidden bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] shadow-lg border-b-2 border-[var(--theme-primary-dark)]">
      <div class="px-3 py-4 mobile:py-1.5 mobile:px-2 flex items-center gap-3 flex-wrap">
        <!-- Title Section - Hidden on mobile -->
        <div class="mobile:hidden">
          <h1 class="text-2xl font-bold text-white drop-shadow-lg">
            Multi-Agent Observability
          </h1>
        </div>

        <!-- Tabs -->
        <div class="flex items-center bg-white/15 rounded-full p-1 shadow-lg border border-white/30">
          <button
            class="px-3 py-1.5 text-sm font-semibold rounded-full transition-theme"
            :class="isLiveTab ? 'bg-white text-[var(--theme-text-primary)] shadow' : 'text-white/80 hover:text-white'"
            @click="currentTab = 'live'"
          >
            Live
          </button>
          <button
            class="px-3 py-1.5 text-sm font-semibold rounded-full transition-theme"
            :class="!isLiveTab ? 'bg-white text-[var(--theme-text-primary)] shadow' : 'text-white/80 hover:text-white'"
            @click="currentTab = 'history'"
          >
            History
          </button>
        </div>

        <!-- Connection Status -->
        <div class="flex items-center mobile:space-x-1 space-x-1.5 ml-auto">
          <div v-if="isConnected" class="flex items-center mobile:space-x-0.5 space-x-1.5">
            <span class="relative flex mobile:h-2 mobile:w-2 h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full mobile:h-2 mobile:w-2 h-3 w-3 bg-green-500"></span>
            </span>
            <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">Connected</span>
          </div>
          <div v-else class="flex items-center mobile:space-x-0.5 space-x-1.5">
            <span class="relative flex mobile:h-2 mobile:w-2 h-3 w-3">
              <span class="relative inline-flex rounded-full mobile:h-2 mobile:w-2 h-3 w-3 bg-red-500"></span>
            </span>
            <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">Disconnected</span>
          </div>
        </div>

        <!-- Event Count and Controls -->
        <div class="flex items-center mobile:space-x-1 space-x-2">
          <template v-if="isLiveTab">
            <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md bg-[var(--theme-primary-dark)] mobile:px-2 mobile:py-0.5 px-3 py-1.5 rounded-full border border-white/30">
              {{ events.length }}
            </span>

            <!-- Clear Button -->
            <button
              @click="handleClearClick"
              class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              title="Clear events"
            >
              <span class="text-2xl mobile:text-base">🗑️</span>
            </button>

            <!-- Search Toggle Button -->
            <button
              @click="showSearch = !showSearch"
              class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              :class="{ 'ring-2 ring-white': showSearch }"
              :title="showSearch ? 'Hide search' : 'Show search'"
            >
              <span class="text-2xl mobile:text-base">&#128269;</span>
            </button>

            <!-- Replay Toggle Button -->
            <button
              @click="showReplay = !showReplay"
              class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              :class="{ 'ring-2 ring-white': showReplay }"
              :title="showReplay ? 'Hide replay' : 'Session replay'"
            >
              <span class="text-2xl mobile:text-base">&#128250;</span>
            </button>

            <!-- Filters Toggle Button -->
            <button
              @click="showFilters = !showFilters"
              class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
              :class="{ 'ring-2 ring-white': showFilters }"
              :title="showFilters ? 'Hide filters' : 'Show filters'"
            >
              <span class="text-2xl mobile:text-base">&#128202;</span>
            </button>
          </template>

          <!-- Theme Manager Button -->
          <button
            @click="handleThemeManagerClick"
            class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            title="Open theme manager"
          >
            <span class="text-2xl mobile:text-base">🎨</span>
          </button>
        </div>
      </div>
    </header>
    
    <div class="flex-1 flex flex-col overflow-hidden">
      <template v-if="isLiveTab">
        <!-- Metadata Panels (Session Info + Environment + Todo Progress + Cost) -->
        <ErrorBoundary
          fallback-title="Metadata Panel Error"
          fallback-message="Unable to display session metadata. The dashboard will continue to function."
        >
          <div v-if="events.length > 0" class="px-3 py-3 mobile:px-2 mobile:py-2 bg-[var(--theme-bg-secondary)] border-b border-[var(--theme-border-primary)]">
            <!-- Agent Selector -->
            <div class="mb-3 mobile:mb-2">
              <AgentSelector
                v-model="selectedAgentForInspection"
                :agents="availableAgents"
              />
            </div>

            <!-- Metadata Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mobile:gap-2">
              <SessionInfoCard :events="selectedAgentEvents" :selectedAgent="selectedAgentForInspection" />
              <EnvironmentInfoPanel :envInfo="latestEnvironment" :selectedAgent="selectedAgentForInspection" />
              <TodoProgressWidget :todoTracking="latestTodoTracking" :perAgentTodos="perAgentTodoTracking" :selectedAgent="selectedAgentForInspection" />
              <SessionCostTracker :events="selectedAgentEvents" :sessionDuration="sessionDuration" :selectedAgent="selectedAgentForInspection" />
            </div>
          </div>
        </ErrorBoundary>

        <!-- Search Panel -->
        <SearchPanel
          v-if="showSearch"
          class="short:hidden"
          v-model="searchResults"
          @search="handleSearchResults"
          @clear="handleSearchClear"
        />

        <!-- Filters -->
        <FilterPanel
          v-if="showFilters"
          class="short:hidden"
          :filters="filters"
          :source-app-options="availableSourceApps"
          :session-id-options="availableSessionIds"
          :agent-type-options="availableAgentTypes"
          :event-type-options="availableEventTypes"
          @update:filters="updateFilters"
        />
        
        <!-- Live Pulse Chart -->
        <ErrorBoundary
          fallback-title="Chart Error"
          fallback-message="Unable to display the activity chart. Event timeline is still available below."
        >
          <LivePulseChart
            :events="events"
            :filters="filters"
            :agent-type-options="availableAgentTypes"
            :event-type-options="availableEventTypes"
            @update-unique-apps="uniqueAppNames = $event"
            @update-all-apps="allAppNames = $event"
            @update-time-range="currentTimeRange = $event"
            @update-filters="updateFilters"
          />
        </ErrorBoundary>

        <!-- Content Area: Swim Lanes + Timeline (guaranteed to fit in remaining space) -->
        <div class="flex flex-col flex-1 overflow-hidden min-h-0">
          <!-- Agent Swim Lane Container (scrollable with max-height) -->
          <ErrorBoundary
            fallback-title="Swim Lane Error"
            fallback-message="Unable to display agent swim lanes. The event timeline below is still functional."
          >
            <div
              v-if="selectedAgentLanes.length > 0"
              class="w-full bg-[var(--theme-bg-secondary)] px-3 py-4 mobile:px-2 mobile:py-2 overflow-y-auto border-b border-[var(--theme-border-primary)] flex-shrink-0"
              style="max-height: 35vh;"
            >
              <AgentSwimLaneContainer
                :selected-agents="selectedAgentLanes"
                :events="events"
                :time-range="currentTimeRange"
                @update:selected-agents="selectedAgentLanes = $event"
              />
            </div>
          </ErrorBoundary>

          <!-- Timeline (always visible with guaranteed minimum space) -->
          <ErrorBoundary
            fallback-title="Timeline Error"
            fallback-message="Unable to display the event timeline. Try refreshing the page or clearing events."
          >
            <div class="flex flex-col flex-1 overflow-hidden" style="min-height: 300px;">
              <EventTimeline
                :events="events"
                :filters="filters"
                :unique-app-names="uniqueAppNames"
                :all-app-names="allAppNames"
                :selected-agents="selectedAgentLanes"
                :selected-agent-for-inspection="selectedAgentForInspection"
                v-model:stick-to-bottom="stickToBottom"
                @select-agent="toggleAgentLane"
                @select-agent-for-inspection="selectAgentForInspection"
              />
            </div>
          </ErrorBoundary>
        </div>
        
        <!-- Stick to bottom button -->
        <StickScrollButton
          class="short:hidden"
          :stick-to-bottom="stickToBottom"
          @toggle="stickToBottom = !stickToBottom"
        />
        
        <!-- Error message -->
        <div
          v-if="error"
          class="fixed bottom-4 left-4 mobile:bottom-3 mobile:left-3 mobile:right-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded mobile:text-xs"
        >
          {{ error }}
        </div>
      </template>

      <HistoryPage v-else class="flex-1" />
    </div>
    
    <!-- Theme Manager -->
    <ThemeManager
      :is-open="showThemeManager"
      @close="showThemeManager = false"
    />

    <!-- Session Replay Modal -->
    <div
      v-if="showReplay && isLiveTab"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click.self="showReplay = false"
    >
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <SessionReplay @close="showReplay = false" />
      </div>
    </div>

    <!-- Toast Notifications -->
    <ToastNotification
      v-if="isLiveTab"
      v-for="(toast, index) in toasts"
      :key="toast.id"
      :index="index"
      :agent-name="toast.agentName"
      :agent-color="toast.agentColor"
      @dismiss="dismissToast(toast.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import type { TimeRange, FilterState } from './types';
import { useWebSocket } from './composables/useWebSocket';
import { useThemes } from './composables/useThemes';
import { useEventColors } from './composables/useEventColors';
import EventTimeline from './components/EventTimeline.vue';
import FilterPanel from './components/FilterPanel.vue';
import StickScrollButton from './components/StickScrollButton.vue';
import LivePulseChart from './components/LivePulseChart.vue';
import ThemeManager from './components/ThemeManager.vue';
import ToastNotification from './components/ToastNotification.vue';
import AgentSwimLaneContainer from './components/AgentSwimLaneContainer.vue';
import SessionInfoCard from './components/SessionInfoCard.vue';
import EnvironmentInfoPanel from './components/EnvironmentInfoPanel.vue';
import TodoProgressWidget from './components/TodoProgressWidget.vue';
import SessionCostTracker from './components/SessionCostTracker.vue';
import ErrorBoundary from './components/ErrorBoundary.vue';
import SearchPanel from './components/SearchPanel.vue';
import SessionReplay from './components/SessionReplay.vue';
import HistoryPage from './components/HistoryPage.vue';
import AgentSelector from './components/AgentSelector.vue';
import { WS_URL } from './config';

// WebSocket connection
const { events, isConnected, error, clearEvents } = useWebSocket(WS_URL);

// Tab navigation
const currentTab = ref<'live' | 'history'>('live');
const isLiveTab = computed(() => currentTab.value === 'live');

// Theme management (sets up theme system)
useThemes();

// Event colors
const { getHexColorForApp } = useEventColors();

// Filters
const filters = ref<FilterState>({
  sourceApp: '',
  sessionId: '',
  eventTypes: new Set<string>(),
  agentTypes: new Set<string>()
});

// UI state
const stickToBottom = ref(true);
const showThemeManager = ref(false);
const showFilters = ref(false);
const showSearch = ref(false);
const showReplay = ref(false);
const searchResults = ref<any[]>([]);
const uniqueAppNames = ref<string[]>([]); // Apps active in current time window
const allAppNames = ref<string[]>([]); // All apps ever seen in session
const selectedAgentLanes = ref<string[]>([]);
const currentTimeRange = ref<TimeRange>('1m'); // Current time range from LivePulseChart
const selectedAgentForInspection = ref<string | null>(null); // Agent selected for metadata inspection (source_app:session_id)

// Toast notifications
interface Toast {
  id: number;
  agentName: string;
  agentColor: string;
}
const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;
const MAX_TOASTS = 3; // Limit simultaneous toasts

// Track seen agents with timestamps for cleanup
const seenAgents = new Map<string, number>();
const AGENT_CLEANUP_INTERVAL = 3600000; // 1 hour in ms

// Helper to get agent ID from event
const getAgentId = (event: any): string => {
  const sessionId = event.session_id?.slice(0, 8) || '';
  return `${event.source_app}:${sessionId}`;
};

// Get events for selected agent (or all if none selected)
const selectedAgentEvents = computed(() => {
  if (!selectedAgentForInspection.value || events.value.length === 0) {
    return events.value;
  }
  return events.value.filter(event => getAgentId(event) === selectedAgentForInspection.value);
});

// Get latest environment info by scanning backwards through events (filtered by selected agent)
const latestEnvironment = computed(() => {
  if (selectedAgentEvents.value.length === 0) return null;

  // Scan backwards through events to find the most recent one with environment data
  for (let i = selectedAgentEvents.value.length - 1; i >= 0; i--) {
    const event = selectedAgentEvents.value[i];
    if (event.environment) {
      return event.environment;
    }
  }

  return null;
});

// Get latest todo tracking info by scanning backwards through events (filtered by selected agent)
const latestTodoTracking = computed(() => {
  if (selectedAgentEvents.value.length === 0) return null;

  // Scan backwards through events to find the most recent one with todo tracking data
  for (let i = selectedAgentEvents.value.length - 1; i >= 0; i--) {
    const event = selectedAgentEvents.value[i];
    if (event.workflow?.todoTracking) {
      return event.workflow.todoTracking;
    }
  }

  return null;
});

// Get per-agent todo tracking for multi-agent view (when no specific agent selected)
const perAgentTodoTracking = computed(() => {
  if (selectedAgentForInspection.value || events.value.length === 0) {
    // Return null when a specific agent is selected (use latestTodoTracking instead)
    return null;
  }

  // Build a map of agent ID -> latest todo tracking
  const agentTodos = new Map<string, { agentId: string; todoTracking: any; lastEventTime: number }>();

  // Scan through all events to find the latest todo tracking for each agent
  for (const event of events.value) {
    if (event.workflow?.todoTracking) {
      const agentId = getAgentId(event);
      const eventTime = event.timestamp || 0;
      const existing = agentTodos.get(agentId);

      // Update if this is newer than what we have
      if (!existing || eventTime > existing.lastEventTime) {
        agentTodos.set(agentId, {
          agentId,
          todoTracking: event.workflow.todoTracking,
          lastEventTime: eventTime
        });
      }
    }
  }

  // Convert to array and sort by most recent activity
  const result = Array.from(agentTodos.values())
    .sort((a, b) => b.lastEventTime - a.lastEventTime)
    .slice(0, 6); // Limit to 6 agents to avoid UI overflow

  return result.length > 0 ? result : null;
});

// Calculate session duration from session metadata (filtered by selected agent)
const sessionDuration = computed(() => {
  if (selectedAgentEvents.value.length === 0) return 0;
  const latestEvent = selectedAgentEvents.value[selectedAgentEvents.value.length - 1];
  return latestEvent.session?.sessionDuration || 0;
});

const resolveAgentType = (event: { agent_type?: string; source_app: string }) => {
  return event.agent_type || event.source_app || 'unknown';
};

// Optimized filter options - use refs with incremental updates instead of computed O(n) scans
// These are updated by the watcher below to avoid recalculating on every event
const availableAgentTypesSet = ref(new Set<string>());
const availableEventTypesSet = ref(new Set<string>());
const availableSourceAppsSet = ref(new Set<string>());
const availableSessionIdsSet = ref(new Set<string>());
let lastEventsLength = 0;

// Derived sorted arrays for the UI
const availableAgentTypes = computed(() => Array.from(availableAgentTypesSet.value).sort());
const availableEventTypes = computed(() => Array.from(availableEventTypesSet.value).sort());
const availableSourceApps = computed(() => Array.from(availableSourceAppsSet.value).sort());
const availableSessionIds = computed(() => Array.from(availableSessionIdsSet.value).sort());

// Helper to extract filter values from a single event
const extractFilterValues = (event: any) => {
  const agentType = resolveAgentType(event);
  if (agentType) availableAgentTypesSet.value.add(agentType);

  if (event.hook_event_type &&
      event.hook_event_type !== 'refresh' &&
      event.hook_event_type !== 'initial') {
    availableEventTypesSet.value.add(event.hook_event_type);
  }

  if (event.source_app) availableSourceAppsSet.value.add(event.source_app);
  if (event.session_id) availableSessionIdsSet.value.add(event.session_id);
};

// Helper to recalculate all filter options from scratch
const recalculateFilterOptions = (eventsArray: any[]) => {
  availableAgentTypesSet.value = new Set<string>();
  availableEventTypesSet.value = new Set<string>();
  availableSourceAppsSet.value = new Set<string>();
  availableSessionIdsSet.value = new Set<string>();
  eventsArray.forEach(extractFilterValues);
};

// Watch events and update filter options incrementally
watch(events, (newEvents) => {
  const currentLength = newEvents.length;

  // If events were removed (e.g., due to maxEvents limit), recalculate from scratch
  if (currentLength < lastEventsLength || currentLength === 0) {
    recalculateFilterOptions(newEvents);
  } else if (currentLength > lastEventsLength) {
    // Only process newly added events (at the end of the array)
    const newEventsCount = currentLength - lastEventsLength;
    for (let i = currentLength - newEventsCount; i < currentLength; i++) {
      extractFilterValues(newEvents[i]);
    }
  }

  lastEventsLength = currentLength;
}, { immediate: true });

const updateFilters = (next: FilterState) => {
  filters.value = {
    sourceApp: next.sourceApp,
    sessionId: next.sessionId,
    eventTypes: new Set(next.eventTypes),
    agentTypes: new Set(next.agentTypes)
  };
};

const clearAllFilters = () => {
  updateFilters({
    sourceApp: '',
    sessionId: '',
    eventTypes: new Set<string>(),
    agentTypes: new Set<string>()
  });
};

// Watch for new agents and show toast + auto-populate swim lanes
watch(uniqueAppNames, (newAppNames) => {
  const now = Date.now();

  // Find agents that are new (not in seenAgents map)
  newAppNames.forEach(appName => {
    if (!seenAgents.has(appName)) {
      seenAgents.set(appName, now);

      // Auto-add new agents to swim lanes (up to 20 max)
      if (!selectedAgentLanes.value.includes(appName)) {
        if (selectedAgentLanes.value.length < 20) {
          selectedAgentLanes.value.push(appName);
        }
      }

      // Limit max simultaneous toasts
      if (toasts.value.length >= MAX_TOASTS) {
        // Remove oldest toast
        const oldestToast = toasts.value.shift();
        if (oldestToast) {
          // Toast will be auto-dismissed by component, just remove from array
        }
      }

      // Show toast for new agent
      const toast: Toast = {
        id: toastIdCounter++,
        agentName: appName,
        agentColor: getHexColorForApp(appName)
      };
      toasts.value.push(toast);
    } else {
      // Update timestamp for active agent
      seenAgents.set(appName, now);
    }
  });

  // Cleanup stale agents (not seen in last hour)
  const cutoffTime = now - AGENT_CLEANUP_INTERVAL;
  for (const [agentName, timestamp] of seenAgents.entries()) {
    if (timestamp < cutoffTime && !newAppNames.includes(agentName)) {
      seenAgents.delete(agentName);
    }
  }
}, { deep: true });

const dismissToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// Handle agent tag clicks for swim lanes
const toggleAgentLane = (agentName: string) => {
  const index = selectedAgentLanes.value.indexOf(agentName);
  if (index >= 0) {
    // Remove from comparison
    selectedAgentLanes.value.splice(index, 1);
  } else {
    // Add to comparison
    selectedAgentLanes.value.push(agentName);
  }
};

// Handle agent selection for inspection (metadata cards)
const selectAgentForInspection = (agentId: string | null) => {
  selectedAgentForInspection.value = agentId;
};

// Get list of available agents for selection
const availableAgents = computed(() => {
  const agents = new Set<string>();
  events.value.forEach(event => {
    const agentId = getAgentId(event);
    if (agentId) {
      agents.add(agentId);
    }
  });
  return Array.from(agents).sort();
});

// Handle clear button click
const handleClearClick = () => {
  clearEvents();
  selectedAgentLanes.value = [];
  selectedAgentForInspection.value = null;
  toasts.value = [];
  seenAgents.clear();
  clearAllFilters();
};

// Debug handler for theme manager
const handleThemeManagerClick = () => {
  console.log('Theme manager button clicked!');
  showThemeManager.value = true;
};

// Search handlers
const handleSearchResults = (results: any[]) => {
  searchResults.value = results;
  console.log(`Search returned ${results.length} results`);
};

const handleSearchClear = () => {
  searchResults.value = [];
};

// Cleanup stale selected agent lanes periodically
let cleanupInterval: number | null = null;

const cleanupStaleAgentLanes = () => {
  // Remove agents from selectedAgentLanes if they're not in current uniqueAppNames
  selectedAgentLanes.value = selectedAgentLanes.value.filter(agentName =>
    uniqueAppNames.value.includes(agentName)
  );
};

onMounted(() => {
  // Run cleanup every 30 seconds
  cleanupInterval = window.setInterval(cleanupStaleAgentLanes, 30000);
});

onUnmounted(() => {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
  }
});
</script>
