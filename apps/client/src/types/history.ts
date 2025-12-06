import type { HookEvent } from '../types';

export type SessionStatus = 'success' | 'error' | 'partial' | 'ongoing';

export interface CriticalEventSummary {
  type: 'error' | 'hitl' | 'timeout' | 'high_cost' | 'long_tool';
  count: number;
  first_at: number;
}

export interface SessionSummary {
  session_id: string;
  source_app: string;
  agent_type: string;
  repo_name?: string;
  project_name?: string;
  script_name?: string;
  branch_name?: string;
  commit_hash?: string;
  start_time: number;
  end_time?: number;
  duration_ms?: number;
  status: SessionStatus;
  has_errors: boolean;
  has_hitl: boolean;
  event_count: number;
  critical_event_count: number;
  total_cost_usd: number;
  model_name?: string;
  critical_events_summary: CriticalEventSummary[];
}

export interface SessionFilters {
  start_time?: number;
  end_time?: number;
  source_app?: string;
  repo_name?: string;
  status?: SessionStatus;
  has_critical_events?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'recency' | 'severity' | 'duration' | 'cost';
}

export interface HistoryFilterOptions {
  repos: string[];
  source_apps: string[];
  statuses: string[];
}

export interface SessionDetailResponse {
  session: SessionSummary;
  events: HookEvent[];
  critical_events: HookEvent[];
}
