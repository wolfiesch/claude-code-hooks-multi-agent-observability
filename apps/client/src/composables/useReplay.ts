import { computed, reactive, onUnmounted } from 'vue';
import type { HookEvent } from '../types';
import { API_BASE_URL } from '../config';

export interface ReplayState {
  sessionId: string | null;
  events: HookEvent[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  startTime: number;
  endTime: number;
  totalDuration: number;
  playbackSpeed: number; // 0.5, 1, 2, 4, etc.
}

export function useReplay() {
  const state = reactive<ReplayState>({
    sessionId: null,
    events: [],
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    startTime: 0,
    endTime: 0,
    totalDuration: 0,
    playbackSpeed: 1
  });

  let playbackInterval: ReturnType<typeof setInterval> | null = null;

  // Computed properties
  const currentEvent = computed(() => {
    if (state.events.length === 0) return null;
    return state.events[state.currentIndex] || null;
  });

  const progress = computed(() => {
    if (state.events.length <= 1) return 0;
    return (state.currentIndex / (state.events.length - 1)) * 100;
  });

  const currentTime = computed(() => {
    if (!currentEvent.value || !state.startTime) return 0;
    return currentEvent.value.timestamp! - state.startTime;
  });

  const formattedCurrentTime = computed(() => {
    return formatDuration(currentTime.value);
  });

  const formattedTotalDuration = computed(() => {
    return formatDuration(state.totalDuration);
  });

  const eventCounts = computed(() => {
    const counts: Record<string, number> = {};
    state.events.forEach(event => {
      counts[event.hook_event_type] = (counts[event.hook_event_type] || 0) + 1;
    });
    return counts;
  });

  // Load session events
  async function loadSession(sessionId: string): Promise<void> {
    state.isLoading = true;
    state.error = null;
    state.sessionId = sessionId;

    try {
      const response = await fetch(`${API_BASE_URL}/events/session/${sessionId}`);

      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.statusText}`);
      }

      const data = await response.json();

      state.events = data.events;
      state.currentIndex = 0;
      state.totalDuration = data.duration_ms;
      state.startTime = data.start_time || 0;
      state.endTime = data.end_time || 0;

      if (state.events.length === 0) {
        state.error = 'No events found for this session';
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Failed to load session';
      console.error('Failed to load session:', error);
    } finally {
      state.isLoading = false;
    }
  }

  // Play the replay
  function play(): void {
    if (state.isPlaying || state.events.length === 0) return;
    if (state.currentIndex >= state.events.length - 1) {
      // If at end, restart from beginning
      state.currentIndex = 0;
    }

    state.isPlaying = true;

    // Calculate delay based on real event timing, scaled
    const advanceToNext = () => {
      if (state.currentIndex >= state.events.length - 1) {
        pause();
        return;
      }

      const currentTimestamp = state.events[state.currentIndex].timestamp || 0;
      const nextTimestamp = state.events[state.currentIndex + 1].timestamp || 0;
      let delay = nextTimestamp - currentTimestamp;

      // Cap max delay at 2 seconds for better UX
      delay = Math.min(delay, 2000);
      // Min delay of 100ms so we don't skip too fast
      delay = Math.max(delay, 100);

      // Apply playback speed
      delay = delay / state.playbackSpeed;

      playbackInterval = setTimeout(() => {
        if (state.isPlaying) {
          state.currentIndex++;
          advanceToNext();
        }
      }, delay);
    };

    advanceToNext();
  }

  // Pause the replay
  function pause(): void {
    state.isPlaying = false;
    if (playbackInterval) {
      clearTimeout(playbackInterval);
      playbackInterval = null;
    }
  }

  // Toggle play/pause
  function togglePlayPause(): void {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  // Seek to specific index
  function seekTo(index: number): void {
    pause();
    state.currentIndex = Math.max(0, Math.min(index, state.events.length - 1));
  }

  // Seek to percentage (0-100)
  function seekToPercent(percent: number): void {
    const index = Math.floor((percent / 100) * (state.events.length - 1));
    seekTo(index);
  }

  // Step forward one event
  function stepForward(): void {
    pause();
    if (state.currentIndex < state.events.length - 1) {
      state.currentIndex++;
    }
  }

  // Step backward one event
  function stepBackward(): void {
    pause();
    if (state.currentIndex > 0) {
      state.currentIndex--;
    }
  }

  // Jump to first event
  function jumpToStart(): void {
    pause();
    state.currentIndex = 0;
  }

  // Jump to last event
  function jumpToEnd(): void {
    pause();
    state.currentIndex = Math.max(0, state.events.length - 1);
  }

  // Set playback speed
  function setPlaybackSpeed(speed: number): void {
    const wasPlaying = state.isPlaying;
    if (wasPlaying) {
      pause();
    }
    state.playbackSpeed = speed;
    if (wasPlaying) {
      play();
    }
  }

  // Reset replay state
  function reset(): void {
    pause();
    state.sessionId = null;
    state.events = [];
    state.currentIndex = 0;
    state.error = null;
    state.startTime = 0;
    state.endTime = 0;
    state.totalDuration = 0;
    state.playbackSpeed = 1;
  }

  // Format duration in mm:ss or hh:mm:ss
  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Cleanup on unmount
  onUnmounted(() => {
    pause();
  });

  return {
    state,
    currentEvent,
    progress,
    currentTime,
    formattedCurrentTime,
    formattedTotalDuration,
    eventCounts,
    loadSession,
    play,
    pause,
    togglePlayPause,
    seekTo,
    seekToPercent,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    setPlaybackSpeed,
    reset,
    formatDuration
  };
}
