// New interface for human-in-the-loop requests
export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[]; // For multiple choice questions
  timeout?: number; // Optional timeout in seconds
  requiresResponse?: boolean; // Whether response is required or optional
}

// Response interface
export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string; // Selected choice from options
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string; // Optional user identifier
}

// Status tracking interface
export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

// Agent type enumeration for extensibility
export type AgentType = 'claude' | 'codex' | 'gemini' | 'custom';

// Git stats for Codex tracking
export interface GitStats {
  files_changed: number;
  insertions: number;
  deletions: number;
  before_summary: string;
  after_summary: string;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  model_name?: string;

  // NEW: Optional HITL data
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;

  // Tier 0 metadata
  environment?: {
    os?: string;
    osVersion?: string;
    shell?: string;
    pythonVersion?: string;
    nodeVersion?: string;
    workingDirectory?: string;
  };

  // Tier 1 metadata
  session?: {
    sessionId?: string;
    sessionStart?: string;
    sessionDuration?: number;
    model?: string;
  };

  // Tier 2 metadata
  workflow?: {
    todoTracking?: {
      totalTodos: number;
      completedTodos: number;
      inProgressTodos: number;
      pendingTodos: number;
      completionRate: number;
      lastUpdate: string | null;
    };
  };

  // Token and cost tracking
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;

  // NEW: Multi-agent support
  agent_type?: AgentType | string;  // Allow custom agent types
  agent_version?: string;
  parent_session_id?: string;  // For parent-child agent tracking
  git_stats?: GitStats;  // Git statistics for Codex tracking
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
  agent_types: string[];
}

export interface FilterState {
  sourceApp: string;
  sessionId: string;
  eventTypes: Set<string>;
  agentTypes: Set<string>;
}

export interface FilterOption {
  label: string;
  value: string;
  description?: string;
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'hitl_response';
  data: HookEvent | HookEvent[] | HumanInTheLoopResponse;
}

export type TimeRange = '1m' | '3m' | '5m' | '10m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  sessions: Record<string, number>; // session id -> count
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  compact?: boolean; // Enable compact mode for ultra-fine swim lanes (smaller emojis, no backgrounds)
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}

// Session Summary types for Historical Analysis and Session Replay
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

export interface SessionListParams {
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

export interface SessionsResponse {
  sessions: SessionSummary[];
  total_count: number;
  params: SessionListParams;
}
