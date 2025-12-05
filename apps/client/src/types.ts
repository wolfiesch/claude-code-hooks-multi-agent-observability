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
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
  agent_types: string[];
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
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}