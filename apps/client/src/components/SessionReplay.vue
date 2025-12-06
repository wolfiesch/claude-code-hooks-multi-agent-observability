<template>
  <div class="bg-[var(--theme-bg-primary)] rounded-xl shadow-xl border border-[var(--theme-border-primary)] overflow-hidden">
    <!-- Header -->
    <div class="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">&#128250;</span>
        <div>
          <h3 class="text-lg font-bold text-white">Session Replay</h3>
          <p v-if="replay.state.sessionId" class="text-sm text-white/80">
            {{ replay.state.sessionId.slice(0, 8) }}...
          </p>
        </div>
      </div>
      <button
        @click="$emit('close')"
        class="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
        title="Close replay"
      >
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Session Selector (when no session loaded) -->
    <div v-if="!replay.state.sessionId" class="p-6">
      <label class="block text-base font-bold text-[var(--theme-primary)] mb-2">
        Select Session to Replay
      </label>
      <select
        v-model="selectedSessionId"
        size="12"
        class="w-full px-3 py-2 text-sm border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] font-mono max-h-96 overflow-y-auto"
      >
        <option value="" disabled>Choose a session...</option>

        <!-- Today -->
        <optgroup v-if="groupedSessions.today.length > 0" label="━━━ Today ━━━">
          <option
            v-for="session in groupedSessions.today"
            :key="session.session_id"
            :value="session.session_id"
            class="py-1"
          >
            {{ formatSessionDisplay(session) }}
          </option>
        </optgroup>

        <!-- Yesterday -->
        <optgroup v-if="groupedSessions.yesterday.length > 0" label="━━━ Yesterday ━━━">
          <option
            v-for="session in groupedSessions.yesterday"
            :key="session.session_id"
            :value="session.session_id"
            class="py-1"
          >
            {{ formatSessionDisplay(session) }}
          </option>
        </optgroup>

        <!-- This Week -->
        <optgroup v-if="groupedSessions.thisWeek.length > 0" label="━━━ This Week ━━━">
          <option
            v-for="session in groupedSessions.thisWeek"
            :key="session.session_id"
            :value="session.session_id"
            class="py-1"
          >
            {{ formatSessionDisplay(session) }}
          </option>
        </optgroup>

        <!-- Older -->
        <optgroup v-if="groupedSessions.older.length > 0" label="━━━ Older ━━━">
          <option
            v-for="session in groupedSessions.older"
            :key="session.session_id"
            :value="session.session_id"
            class="py-1"
          >
            {{ formatSessionDisplay(session) }}
          </option>
        </optgroup>
      </select>
      <button
        @click="loadSelectedSession"
        :disabled="!selectedSessionId"
        class="mt-4 w-full px-4 py-3 text-base font-medium text-white bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
      >
        Load Session
      </button>
    </div>

    <!-- Loading State -->
    <div v-else-if="replay.state.isLoading" class="p-6 flex flex-col items-center justify-center gap-4">
      <svg class="animate-spin h-12 w-12 text-[var(--theme-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-[var(--theme-text-secondary)]">Loading session events...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="replay.state.error" class="p-6">
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
        {{ replay.state.error }}
      </div>
      <button
        @click="replay.reset()"
        class="mt-4 w-full px-4 py-3 text-base font-medium text-[var(--theme-text-primary)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] rounded-lg transition-all"
      >
        Select Different Session
      </button>
    </div>

    <!-- Replay Controls -->
    <div v-else class="p-4">
      <!-- Session Stats -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-[var(--theme-primary)]">{{ replay.state.events.length }}</p>
          <p class="text-xs text-[var(--theme-text-secondary)]">Events</p>
        </div>
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-[var(--theme-primary)]">{{ replay.formattedTotalDuration.value }}</p>
          <p class="text-xs text-[var(--theme-text-secondary)]">Duration</p>
        </div>
        <div class="bg-[var(--theme-bg-secondary)] rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-[var(--theme-primary)]">{{ replay.state.currentIndex + 1 }}</p>
          <p class="text-xs text-[var(--theme-text-secondary)]">Current</p>
        </div>
      </div>

      <!-- Timeline Scrubber -->
      <div class="mb-4">
        <div class="relative">
          <!-- Progress Bar Background -->
          <div class="h-3 bg-[var(--theme-bg-secondary)] rounded-full overflow-hidden">
            <!-- Progress Fill -->
            <div
              class="h-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] transition-all duration-100"
              :style="{ width: `${replay.progress.value}%` }"
            ></div>
          </div>

          <!-- Clickable Overlay -->
          <input
            type="range"
            :min="0"
            :max="replay.state.events.length - 1"
            :value="replay.state.currentIndex"
            @input="onScrub"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <!-- Event Markers -->
          <div class="absolute inset-0 flex items-center pointer-events-none">
            <div
              v-for="(event, index) in markerEvents"
              :key="index"
              class="absolute w-1 h-1 rounded-full"
              :class="getEventMarkerClass(event)"
              :style="{ left: `${(index / (replay.state.events.length - 1)) * 100}%` }"
              :title="event.hook_event_type"
            ></div>
          </div>
        </div>

        <!-- Time Labels -->
        <div class="flex justify-between mt-1 text-xs text-[var(--theme-text-secondary)]">
          <span>{{ replay.formattedCurrentTime.value }}</span>
          <span>{{ replay.formattedTotalDuration.value }}</span>
        </div>
      </div>

      <!-- Playback Speed Controls -->
      <div class="flex items-center justify-center gap-2 mb-3">
        <span class="text-xs text-[var(--theme-text-secondary)]">Speed:</span>
        <button
          v-for="speed in [0.5, 1, 2, 4]"
          :key="speed"
          @click="replay.setPlaybackSpeed(speed)"
          class="px-2 py-1 text-xs rounded transition-all"
          :class="replay.state.playbackSpeed === speed
            ? 'bg-[var(--theme-primary)] text-white font-bold'
            : 'bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-primary)]/20'"
        >
          {{ speed }}x
        </button>
      </div>

      <!-- Playback Controls -->
      <div class="flex items-center justify-center gap-2 mb-4">
        <!-- Jump to Start -->
        <button
          @click="replay.jumpToStart()"
          class="p-2 rounded-lg bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-primary)]/20 transition-all"
          title="Jump to start"
        >
          <svg class="w-5 h-5 text-[var(--theme-text-primary)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <!-- Step Backward -->
        <button
          @click="replay.stepBackward()"
          :disabled="replay.state.currentIndex === 0"
          class="p-2 rounded-lg bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="Previous event"
        >
          <svg class="w-5 h-5 text-[var(--theme-text-primary)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm10 12V6l-8.5 6z"/>
          </svg>
        </button>

        <!-- Play/Pause -->
        <button
          @click="replay.togglePlayPause()"
          class="p-4 rounded-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)] shadow-lg transition-all"
          :title="replay.state.isPlaying ? 'Pause' : 'Play'"
        >
          <svg v-if="!replay.state.isPlaying" class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>

        <!-- Step Forward -->
        <button
          @click="replay.stepForward()"
          :disabled="replay.state.currentIndex >= replay.state.events.length - 1"
          class="p-2 rounded-lg bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="Next event"
        >
          <svg class="w-5 h-5 text-[var(--theme-text-primary)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/>
          </svg>
        </button>

        <!-- Jump to End -->
        <button
          @click="replay.jumpToEnd()"
          class="p-2 rounded-lg bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-primary)]/20 transition-all"
          title="Jump to end"
        >
          <svg class="w-5 h-5 text-[var(--theme-text-primary)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 18h2V6h-2zM6 6v12l8.5-6z"/>
          </svg>
        </button>
      </div>

      <!-- Current Event Display -->
      <div v-if="replay.currentEvent.value" class="bg-[var(--theme-bg-secondary)] rounded-lg p-4 border border-[var(--theme-border-primary)]">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">{{ getEventIcon(replay.currentEvent.value.hook_event_type) }}</span>
          <span class="font-bold text-[var(--theme-text-primary)]">{{ replay.currentEvent.value.hook_event_type }}</span>
          <span class="text-xs text-[var(--theme-text-secondary)] ml-auto">
            {{ formatTimestamp(replay.currentEvent.value.timestamp) }}
          </span>
        </div>

        <!-- Event Summary -->
        <p v-if="replay.currentEvent.value.summary" class="text-sm text-[var(--theme-text-secondary)] mb-2">
          {{ replay.currentEvent.value.summary }}
        </p>

        <!-- Payload Display (Always Visible) -->
        <div class="mt-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-[var(--theme-primary)]">Payload</span>
            <button
              @click="copyPayloadToClipboard"
              class="px-2 py-1 text-xs bg-[var(--theme-bg-primary)] hover:bg-[var(--theme-primary)]/20 border border-[var(--theme-border-primary)] rounded transition-all flex items-center gap-1"
              :title="copyButtonText"
            >
              <svg v-if="!copied" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{{ copyButtonText }}</span>
            </button>
          </div>
          <pre class="p-2 bg-[var(--theme-bg-primary)] rounded overflow-x-auto text-[var(--theme-text-secondary)] text-xs max-h-64 overflow-y-auto">{{ JSON.stringify(replay.currentEvent.value.payload, null, 2) }}</pre>
        </div>
      </div>

      <!-- Reset Button -->
      <button
        @click="replay.reset()"
        class="mt-4 w-full px-4 py-2 text-sm font-medium text-[var(--theme-text-secondary)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] rounded-lg transition-all"
      >
        Load Different Session
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useReplay } from '../composables/useReplay';
import type { HookEvent, SessionSummary, SessionsResponse } from '../types';
import { API_BASE_URL } from '../config';

defineEmits<{
  close: [];
}>();

const replay = useReplay();
const selectedSessionId = ref('');
const availableSessions = ref<SessionSummary[]>([]);
const copied = ref(false);

// Copy button text
const copyButtonText = computed(() => copied.value ? 'Copied!' : 'Copy');

// Group sessions by date
const groupedSessions = computed(() => {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const groups = {
    today: [] as SessionSummary[],
    yesterday: [] as SessionSummary[],
    thisWeek: [] as SessionSummary[],
    older: [] as SessionSummary[]
  };

  availableSessions.value.forEach(session => {
    const sessionTime = session.end_time || session.start_time;
    if (sessionTime >= oneDayAgo) {
      groups.today.push(session);
    } else if (sessionTime >= twoDaysAgo) {
      groups.yesterday.push(session);
    } else if (sessionTime >= oneWeekAgo) {
      groups.thisWeek.push(session);
    } else {
      groups.older.push(session);
    }
  });

  return groups;
});

// Format session display text
const formatSessionDisplay = (session: SessionSummary): string => {
  const time = formatTime(session.end_time || session.start_time);
  const projectName = session.repo_name || session.project_name || session.source_app;
  const truncatedProject = projectName.length > 30
    ? projectName.slice(0, 27) + '...'
    : projectName;
  const duration = formatDuration(session.duration_ms || 0);
  const events = session.event_count;

  return `${time} - ${truncatedProject} • ${events} events • ${duration}`;
};

// Format time (HH:MM AM/PM)
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Format duration (X.X min or X.X hr)
const formatDuration = (ms: number): string => {
  const minutes = ms / 1000 / 60;
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = minutes / 60;
  return `${hours.toFixed(1)} hr`;
};

// Fetch available sessions
const fetchSessions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions?sort_by=recency&limit=200`);
    if (response.ok) {
      const data: SessionsResponse = await response.json();
      availableSessions.value = data.sessions;
    }
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
  }
};

// Load selected session
const loadSelectedSession = () => {
  if (selectedSessionId.value) {
    replay.loadSession(selectedSessionId.value);
  }
};

// Get subset of events for markers (limit to avoid performance issues)
const markerEvents = computed(() => {
  const events = replay.state.events;
  if (events.length <= 100) return events;
  // Sample every nth event
  const step = Math.ceil(events.length / 100);
  return events.filter((_, i) => i % step === 0);
});

// Handle scrubber input
const onScrub = (event: Event) => {
  const target = event.target as HTMLInputElement;
  replay.seekTo(parseInt(target.value, 10));
};

// Get event marker class based on type
const getEventMarkerClass = (event: HookEvent) => {
  const type = event.hook_event_type;
  if (type.includes('Error') || type.includes('error')) {
    return 'bg-red-500';
  }
  if (type.includes('Start') || type.includes('Complete')) {
    return 'bg-green-500';
  }
  return 'bg-[var(--theme-primary)]';
};

// Get event icon
const getEventIcon = (type: string) => {
  if (type.includes('Bash') || type.includes('Shell')) return '\uD83D\uDCBB';
  if (type.includes('Read')) return '\uD83D\uDCD6';
  if (type.includes('Write') || type.includes('Edit')) return '\u270F\uFE0F';
  if (type.includes('Error')) return '\u26A0\uFE0F';
  if (type.includes('Start')) return '\uD83D\uDE80';
  if (type.includes('Complete') || type.includes('Stop')) return '\u2705';
  if (type.includes('Tool')) return '\uD83D\uDD27';
  return '\uD83D\uDCE1';
};

// Copy payload to clipboard
const copyPayloadToClipboard = async () => {
  if (!replay.currentEvent.value) return;

  try {
    const payloadText = JSON.stringify(replay.currentEvent.value.payload, null, 2);
    await navigator.clipboard.writeText(payloadText);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy payload:', error);
  }
};

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  // Don't trigger shortcuts if user is typing in an input
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return;
  }

  // Only handle shortcuts when a session is loaded
  if (!replay.state.sessionId || replay.state.events.length === 0) {
    return;
  }

  switch (event.key) {
    case ' ':
      event.preventDefault();
      replay.togglePlayPause();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      replay.stepBackward();
      break;
    case 'ArrowRight':
      event.preventDefault();
      replay.stepForward();
      break;
    case 'Home':
      event.preventDefault();
      replay.jumpToStart();
      break;
    case 'End':
      event.preventDefault();
      replay.jumpToEnd();
      break;
  }
};

// Format timestamp
const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString();
};

onMounted(() => {
  fetchSessions();
  // Add keyboard event listener
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // Remove keyboard event listener
  window.removeEventListener('keydown', handleKeydown);
});
</script>
