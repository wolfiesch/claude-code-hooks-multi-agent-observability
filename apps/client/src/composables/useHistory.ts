import { computed, ref } from 'vue';
import { API_BASE_URL } from '../config';
import type { HookEvent } from '../types';
import type {
  HistoryFilterOptions,
  SessionDetailResponse,
  SessionFilters,
  SessionSummary
} from '../types/history';

const DEFAULT_LIMIT = 20;

function buildSearchParams(filters: SessionFilters): string {
  const search = new URLSearchParams();
  const merged = {
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort_by: 'recency' as SessionFilters['sort_by'],
    ...filters
  };

  if (merged.start_time) search.set('start_time', String(merged.start_time));
  if (merged.end_time) search.set('end_time', String(merged.end_time));
  if (merged.source_app) search.set('source_app', merged.source_app);
  if (merged.repo_name) search.set('repo_name', merged.repo_name);
  if (merged.status) search.set('status', merged.status);
  if (typeof merged.has_critical_events === 'boolean') {
    search.set('has_critical_events', String(merged.has_critical_events));
  }
  if (merged.limit) search.set('limit', String(merged.limit));
  if (merged.offset) search.set('offset', String(merged.offset));
  if (merged.sort_by) search.set('sort_by', merged.sort_by);

  return search.toString();
}

export function useHistory() {
  const sessions = ref<SessionSummary[]>([]);
  const totalCount = ref(0);
  const filters = ref<SessionFilters>({
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort_by: 'recency'
  });
  const filterOptions = ref<HistoryFilterOptions>({
    repos: [],
    source_apps: [],
    statuses: []
  });
  const isLoading = ref(false);
  const isDetailLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedSessionDetail = ref<SessionDetailResponse | null>(null);

  const hasFiltersApplied = computed(() => {
    const { start_time, end_time, source_app, repo_name, status, has_critical_events } = filters.value;
    return Boolean(
      start_time ||
      end_time ||
      source_app ||
      repo_name ||
      status ||
      has_critical_events
    );
  });

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/filter-options`);
      if (!response.ok) {
        throw new Error(`Failed to load filter options (${response.status})`);
      }
      const data = await response.json() as HistoryFilterOptions;
      filterOptions.value = {
        repos: data.repos || [],
        source_apps: data.source_apps || [],
        statuses: data.statuses || []
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching filter options';
      error.value = message;
      console.error(message);
    }
  };

  const fetchSessions = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const query = buildSearchParams(filters.value);
      const response = await fetch(`${API_BASE_URL}/sessions?${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions (${response.status})`);
      }
      const data = await response.json() as { sessions: SessionSummary[]; total_count?: number };
      sessions.value = data.sessions || [];
      totalCount.value = data.total_count ?? sessions.value.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching sessions';
      error.value = message;
      sessions.value = [];
      totalCount.value = 0;
      console.error(message);
    } finally {
      isLoading.value = false;
    }
  };

  const fetchSessionDetail = async (sessionId: string) => {
    if (!sessionId) return;
    isDetailLoading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session ${sessionId} (${response.status})`);
      }
      const data = await response.json() as SessionDetailResponse;
      selectedSessionDetail.value = {
        session: data.session,
        events: (data.events as HookEvent[]) || [],
        critical_events: (data.critical_events as HookEvent[]) || []
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching session detail';
      error.value = message;
      selectedSessionDetail.value = null;
      console.error(message);
    } finally {
      isDetailLoading.value = false;
    }
  };

  const updateFilters = (partial: Partial<SessionFilters>) => {
    filters.value = {
      ...filters.value,
      ...partial,
      offset: partial.offset ?? 0
    };
  };

  const clearSelectedSession = () => {
    selectedSessionDetail.value = null;
  };

  return {
    sessions,
    totalCount,
    filters,
    filterOptions,
    isLoading,
    isDetailLoading,
    error,
    selectedSessionDetail,
    hasFiltersApplied,
    fetchSessions,
    fetchFilterOptions,
    fetchSessionDetail,
    updateFilters,
    clearSelectedSession
  };
}
