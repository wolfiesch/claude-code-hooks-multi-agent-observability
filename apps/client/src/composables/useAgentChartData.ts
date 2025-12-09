import { ref, computed } from 'vue';
import type { HookEvent, ChartDataPoint, TimeRange } from '../types';

/**
 * Event types to exclude from swim lane visualization.
 * PreToolUse is excluded because PostToolUse provides the same information
 * with additional context (success/failure, duration). This reduces visual noise
 * and makes swim lanes more readable.
 */
const DEDUPLICATED_EVENT_TYPES = new Set(['PreToolUse']);

/**
 * Composable for rendering ultra-detailed chart data for individual agent swim lanes.
 * Uses much smaller bucket sizes to show individual events with emojis.
 *
 * @param agentName - The specific agent ID (format: "app:session") to track
 * @returns Chart data methods with minimal event grouping for visual clarity
 */
export function useAgentChartData(agentName: string) {
  const timeRange = ref<TimeRange>('1m');
  const dataPoints = ref<ChartDataPoint[]>([]);

  // Parse agent ID filter (format: "app:session")
  const parseAgentId = (agentId: string): { app: string; session: string } | null => {
    const parts = agentId.split(':');
    if (parts.length === 2) {
      return { app: parts[0], session: parts[1] };
    }
    return null;
  };

  // Keep session matching consistent with agent chips (8-char prefix)
  const normalizeSessionId = (sessionId?: string | null) => (sessionId || '').slice(0, 8);

  const agentIdParsed = agentName ? parseAgentId(agentName) : null;
  const targetSessionPrefix = agentIdParsed ? normalizeSessionId(agentIdParsed.session) : '';

  const matchesAgent = (event: HookEvent) => {
    if (!agentIdParsed) return true;
    return (
      event.source_app === agentIdParsed.app &&
      normalizeSessionId(event.session_id) === targetSessionPrefix
    );
  };

  // Store all events for re-aggregation when time range changes
  const allEvents = ref<HookEvent[]>([]);

  // Debounce for high-frequency events
  let eventBuffer: HookEvent[] = [];
  let debounceTimer: number | null = null;
  const DEBOUNCE_DELAY = 50; // 50ms debounce

  // Ultra-fine buckets for swim lanes - show individual events with emojis
  const timeRangeConfig = {
    '1m': {
      duration: 60 * 1000,
      bucketSize: 200, // 200ms buckets for individual event visibility
      maxPoints: 300 // 60s / 0.2s = 300 points
    },
    '3m': {
      duration: 3 * 60 * 1000,
      bucketSize: 600, // 600ms buckets
      maxPoints: 300 // 180s / 0.6s = 300 points
    },
    '5m': {
      duration: 5 * 60 * 1000,
      bucketSize: 1000, // 1 second buckets
      maxPoints: 300 // 300s / 1s = 300 points
    },
    '10m': {
      duration: 10 * 60 * 1000,
      bucketSize: 2000, // 2 second buckets
      maxPoints: 300 // 600s / 2s = 300 points
    }
  };

  const currentConfig = computed(() => timeRangeConfig[timeRange.value]);

  const getBucketTimestamp = (timestamp: number): number => {
    const config = currentConfig.value;
    return Math.floor(timestamp / config.bucketSize) * config.bucketSize;
  };

  const processEventBuffer = () => {
    const eventsToProcess = [...eventBuffer];
    eventBuffer = [];

    // Add events to our complete list
    allEvents.value.push(...eventsToProcess);

    eventsToProcess.forEach(event => {
      if (!event.timestamp) return;

      // Skip if event doesn't match agent ID filter
      if (!matchesAgent(event)) {
        return;
      }

      // Skip deduplicated event types (e.g., PreToolUse - PostToolUse is sufficient)
      if (DEDUPLICATED_EVENT_TYPES.has(event.hook_event_type)) {
        return;
      }

      const bucketTime = getBucketTimestamp(event.timestamp);

      // Find existing bucket or create new one
      let bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        // Track event types
        if (!bucket.eventTypes) {
          bucket.eventTypes = {};
        }
        bucket.eventTypes[event.hook_event_type] = (bucket.eventTypes[event.hook_event_type] || 0) + 1;
        // Track sessions
        if (!bucket.sessions) {
          bucket.sessions = {};
        }
        bucket.sessions[event.session_id] = (bucket.sessions[event.session_id] || 0) + 1;
      } else {
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [event.hook_event_type]: 1 },
          sessions: { [event.session_id]: 1 }
        });
      }
    });

    // Clean old data once after processing all events
    cleanOldData();
    cleanOldEvents();
  };

  const addEvent = (event: HookEvent) => {
    eventBuffer.push(event);

    // Clear existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = window.setTimeout(() => {
      processEventBuffer();
      debounceTimer = null;
    }, DEBOUNCE_DELAY);
  };

  const cleanOldData = () => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    dataPoints.value = dataPoints.value.filter(dp => dp.timestamp >= cutoffTime);

    // Ensure we don't exceed max points
    if (dataPoints.value.length > currentConfig.value.maxPoints) {
      dataPoints.value = dataPoints.value.slice(-currentConfig.value.maxPoints);
    }
  };

  const cleanOldEvents = () => {
    const now = Date.now();
    // Keep events for the longest supported time range (10 minutes)
    // This ensures reaggregation works correctly when switching between ranges
    const maxDuration = Math.max(...Object.values(timeRangeConfig).map(c => c.duration));
    const cutoffTime = now - maxDuration;

    allEvents.value = allEvents.value.filter(event =>
      event.timestamp && event.timestamp >= cutoffTime
    );
  };

  const getChartData = (): ChartDataPoint[] => {
    const now = Date.now();
    const config = currentConfig.value;
    const startTime = now - config.duration;

    // Create array of all time buckets in range
    const buckets: ChartDataPoint[] = [];
    for (let time = startTime; time <= now; time += config.bucketSize) {
      const bucketTime = getBucketTimestamp(time);
      const existingBucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      buckets.push({
        timestamp: bucketTime,
        count: existingBucket?.count || 0,
        eventTypes: existingBucket?.eventTypes || {},
        sessions: existingBucket?.sessions || {}
      });
    }

    // Return only the last maxPoints buckets
    return buckets.slice(-config.maxPoints);
  };

  const setTimeRange = (range: TimeRange) => {
    timeRange.value = range;
    // Re-aggregate data for new bucket size
    reaggregateData();
  };

  const reaggregateData = () => {
    // Clear current data points
    dataPoints.value = [];

    // Re-process all events with new bucket size
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    // Filter events within the time range, by agent ID, and exclude deduplicated types
    let relevantEvents = allEvents.value.filter(event =>
      event.timestamp &&
      event.timestamp >= cutoffTime &&
      matchesAgent(event) &&
      !DEDUPLICATED_EVENT_TYPES.has(event.hook_event_type)
    );

    // Re-aggregate all relevant events
    relevantEvents.forEach(event => {
      if (!event.timestamp) return;

      const bucketTime = getBucketTimestamp(event.timestamp);

      // Find existing bucket or create new one
      let bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        bucket.eventTypes[event.hook_event_type] = (bucket.eventTypes[event.hook_event_type] || 0) + 1;
        bucket.sessions[event.session_id] = (bucket.sessions[event.session_id] || 0) + 1;
      } else {
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [event.hook_event_type]: 1 },
          sessions: { [event.session_id]: 1 }
        });
      }
    });

    // Clean up
    cleanOldData();
  };

  // Auto-clean old data every second
  const cleanupInterval = setInterval(() => {
    cleanOldData();
    cleanOldEvents();
  }, 1000);

  // Cleanup on unmount
  const cleanup = () => {
    clearInterval(cleanupInterval);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      processEventBuffer(); // Process any remaining events
    }
  };

  // Compute event timing metrics (min, max, average gap between events in ms)
  const eventTimingMetrics = computed(() => {
    const now = Date.now();
    const config = currentConfig.value;
    const cutoffTime = now - config.duration;

    // Get all events in current time window, sorted by timestamp
    const windowEvents = allEvents.value
      .filter(e => e.timestamp && e.timestamp >= cutoffTime && matchesAgent(e))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (windowEvents.length < 2) {
      return { minGap: 0, maxGap: 0, avgGap: 0 };
    }

    // Calculate gaps between consecutive events
    const gaps: number[] = [];
    for (let i = 1; i < windowEvents.length; i++) {
      const gap = (windowEvents[i].timestamp || 0) - (windowEvents[i - 1].timestamp || 0);
      if (gap > 0) {
        gaps.push(gap);
      }
    }

    if (gaps.length === 0) {
      return { minGap: 0, maxGap: 0, avgGap: 0 };
    }

    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    return { minGap, maxGap, avgGap };
  });

  return {
    timeRange,
    dataPoints,
    addEvent,
    getChartData,
    setTimeRange,
    cleanup,
    currentConfig,
    eventTimingMetrics
  };
}
