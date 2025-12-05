# Historical Analysis Page - Feature Plan

**Created:** 2025-12-05
**Status:** Planning
**Last Updated:** 2025-12-05 01:55 PM

---

## Vision

A dedicated **History** page that serves as the forensic and trend analysis companion to the Live dashboard. Designed for power users running many concurrent Claude Code and Codex CLI sessions who need to:

- **Investigate failures** - Quickly find and drill into problematic sessions
- **Understand patterns** - See trends across repos, projects, and time
- **Debug weird behavior** - Access full context including environment and config
- **Track costs and performance** - Identify expensive or slow operations

### Core Mental Model

Users think in terms of **units of work**, not raw sessions:
- **Repository / Project** - "What happened in my ufc-pokedex repo?"
- **Workflow / Script** - "How did my `./scripts/smoke-test` runs perform?"
- **Time window** - "What broke this morning?"
- **Outcome** - "Show me all failures"

The UI must support these natural queries as first-class interactions.

---

## Priority Tiers

### T0 - Core Timeline Experience (MVP)

These features are required for the page to be useful to a power user.

| Feature | Description | Rationale |
|---------|-------------|-----------|
| **Interactive Zoomable Timeline** | D3.js or Canvas timeline showing sessions over time. Zoom from days → hours → minutes → seconds. Pan to navigate. | Centerpiece UX - "zoom in, see critical steps" |
| **Session Bars** | Horizontal bars representing session duration on timeline. Color-coded by outcome (success/error/partial). | Visual pattern recognition for bursts, outages, regressions |
| **Event Markers** | Color-coded markers within session bars: errors (red), HITL (yellow), completions (green), tools (blue) | Instantly spot critical moments |
| **Critical Event Detection** | Auto-flag: errors, HITL requests, long tool calls (>30s), session failures, high-cost operations | Users want "critical steps" highlighted automatically |
| **Event Detail Drawer** | Click event marker → slide-in drawer with full payload, chat context, summary, related events | Deep drill-down without losing timeline context |
| **Status Filter** | Filter by: success / error / partial / in-progress | Failure-centric exploration is primary workflow |
| **Source Filter** | Filter by: Claude Code vs Codex CLI vs custom agents | Multi-agent users need this immediately |
| **Repository/Project Filter** | Filter by repo name or project identifier | "Unit of work" context - most common grouping |
| **"Failures Only" Preset** | One-click toggle showing only sessions with critical events | Fast triage for "something is broken" workflow |
| **Time Range Selector** | Quick presets (Last hour, Today, This week) + custom date picker | Navigate large histories efficiently |

**T0 User Story:**
> "Last 24h, repo ufc-pokedex, only failures" → zoom in → click session → see event detail drawer → understand what went wrong.

---

### T1 - Enhanced Analysis (Depth)

These features add significant value for daily workflows.

| Feature | Description | Rationale |
|---------|-------------|-----------|
| **Session Overview Cards** | Compact cards: duration, cost, tools used, outcome, model, event counts | Fast visual triage - scan many sessions quickly |
| **Grouping by Repository/Project** | Collapsible groups on timeline or list view | Matches how users organize their work |
| **Performance Hotspots View** | Mode that highlights: slowest tools, highest cost sessions, longest durations | Optimization and debugging use case |
| **Density View (Zoomed Out)** | Heatmap or density bars when zoomed to day/week level | Prevents noise at scale; shows activity patterns |
| **Session Search** | Full-text search across session metadata, summaries, tool names | Find specific sessions in large histories |
| **Sort Options** | Sort by: recency, severity, duration, cost | Different workflows need different orderings |
| **Workflow/Script Grouping** | Group sessions by entrypoint script or workflow name | Codex CLI power users think in scripts |
| **Deep Link to Origin** | "Open in Claude Code" or "View logs in CLI" button per session | Jump from history back to coding environment |
| **Cost Summary per Time Range** | Show total cost for selected time range / filters | Budget tracking and awareness |

---

### T2 - Power Features (Advanced)

These are valuable but can wait until core experience is solid.

| Feature | Description |
|---------|-------------|
| **Session Comparison View** | Select 2-3 sessions, see side-by-side timelines + diff of outcomes |
| **Aggregated Statistics Dashboard** | Charts: sessions/day, avg duration, cost trends, error rates over time |
| **Event Flow Visualization** | Sankey or flow diagram showing typical event progressions |
| **Bookmarks & Notes** | Mark interesting sessions, add notes for later reference |
| **Export/Share** | Export session timeline as image/PDF, shareable link |
| **Regression Detection** | "Compare last N runs" for a given workflow; alert on performance degradation |
| **Rerun Capability** | Show CLI command to rerun with same parameters; or "Copy command" button |
| **Branch Grouping** | Group/filter sessions by git branch |
| **Commit Grouping** | Group/filter sessions by commit hash |
| **Environment/Config Snapshot** | Store and display config_hash, env vars snapshot per session |
| **Pinned Repo/Workflow Default** | Remember user's preferred default filter |

---

## Data Model Enhancements

### Session Metadata (Required for T0/T1)

Ensure the session model includes or can derive:

| Field | Source | Priority |
|-------|--------|----------|
| `repo_name` | Extract from working directory or git remote | T0 |
| `project_name` | Working directory name or explicit metadata | T0 |
| `outcome` | Derive from events: success/error/partial/ongoing | T0 |
| `script_name` | Codex CLI entrypoint; Claude Code command | T1 |
| `branch_name` | Git branch at session start | T2 |
| `commit_hash` | Git HEAD at session start | T2 |
| `config_hash` | Hash of relevant config for debugging | T2 |
| `total_cost_usd` | Sum of event costs | T0 (exists) |
| `has_errors` | Boolean flag for quick filtering | T0 |
| `has_hitl` | Boolean flag for HITL presence | T0 |

### Critical Event Types

Expand critical event detection to include:

| Type | Criteria | Color |
|------|----------|-------|
| Error | Any error in payload or hook_event_type | Red |
| HITL Request | humanInTheLoop present | Yellow |
| Session Failure | Session ended with error state | Red |
| Long Tool Call | Tool execution > 30 seconds | Orange |
| High Cost | Single event > $0.10 or session > $1.00 | Orange |
| Timeout | Tool or session timeout | Red |
| First/Last Event | Session boundaries | Gray |

---

## Architecture

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Time Range  │ │ Repo Filter  │ │ Source      │ │ [x] Failures    │   │
│  │ [Today ▾]   │ │ [All ▾]      │ │ [All ▾]     │ │     Only        │   │
│  └─────────────┘ └──────────────┘ └─────────────┘ └─────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Search: [____________________________]  Sort: [Recency ▾]         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  TIMELINE (Main Canvas)                                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Zoom: [─────●─────] 3h view                    [−] [+] [Reset]   │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │                                                                    │  │
│  │  09:00    10:00    11:00    12:00    13:00    14:00    15:00     │  │
│  │    │        │        │        │        │        │        │        │  │
│  │                                                                    │  │
│  │  [████████████████████]  claude:abc123 ✓                          │  │
│  │           ●  ●   ●●  ●                                            │  │
│  │                                                                    │  │
│  │      [██████████████████████████]  codex:def456 ✗                 │  │
│  │         ●  ● ●    ●  🔴  ●   ●                                    │  │
│  │                                                                    │  │
│  │          [████████████]  claude:ghi789 ✓                          │  │
│  │             ●  ●  🟡  ●                                           │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  SESSION CARDS (below timeline, scrollable)                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐           │
│  │ codex:def456    │ │ claude:abc123   │ │ claude:ghi789   │           │
│  │ ✗ Error         │ │ ✓ Success       │ │ ✓ Success       │           │
│  │ 45m · $0.23     │ │ 12m · $0.08     │ │ 8m · $0.05      │           │
│  │ 23 tools · 4 err│ │ 15 tools        │ │ 10 tools · 1 HITL│          │
│  │ ufc-pokedex     │ │ ufc-pokedex     │ │ hooks-project   │           │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘

EVENT DETAIL DRAWER (slides in from right when event clicked)
┌────────────────────────────────────────┐
│ ← Back                    [X] Close    │
├────────────────────────────────────────┤
│ PreToolUse: Bash                       │
│ 10:23:45 AM · claude:abc123            │
├────────────────────────────────────────┤
│ Summary                                │
│ Running npm test to verify changes...  │
├────────────────────────────────────────┤
│ Payload                    [Expand ▾]  │
│ {                                      │
│   "tool": "Bash",                      │
│   "command": "npm test"                │
│ }                                      │
├────────────────────────────────────────┤
│ Chat Context              [Expand ▾]  │
│ User: Can you run the tests?           │
│ Assistant: I'll run npm test...        │
├────────────────────────────────────────┤
│ Related Events                         │
│ • PostToolUse: Bash (10:23:52)         │
│ • PreToolUse: Edit (10:24:01)          │
└────────────────────────────────────────┘
```

### Components to Build

| Component | Purpose | Priority | Based On |
|-----------|---------|----------|----------|
| `HistoryPage.vue` | Page container with routing | T0 | New |
| `ZoomableTimeline.vue` | Main timeline with zoom/pan | T0 | Enhance AgentSwimLane |
| `SessionBar.vue` | Session bar on timeline | T0 | New |
| `EventMarker.vue` | Event markers with tooltips | T0 | Adapt from SessionReplay |
| `EventDetailDrawer.vue` | Slide-in event details | T0 | New |
| `TimeRangeSelector.vue` | Date picker + presets | T0 | New |
| `FilterBar.vue` | Status/source/repo filters | T0 | New |
| `SessionCard.vue` | Compact session summary | T1 | Enhance SessionInfoCard |
| `DensityHeatmap.vue` | Zoomed-out density view | T1 | New |
| `PerformanceView.vue` | Hotspots mode | T1 | New |
| `SessionCompare.vue` | Side-by-side comparison | T2 | New |
| `StatsCharts.vue` | Aggregated statistics | T2 | New |

### Composables

| Composable | Purpose | Priority |
|------------|---------|----------|
| `useHistory.ts` | Fetch sessions, handle filters, pagination | T0 |
| `useTimeline.ts` | Timeline zoom/pan state, visible range | T0 |
| `useCriticalEvents.ts` | Detect and classify critical events | T0 |
| `useSessionGroups.ts` | Group sessions by repo/workflow | T1 |

---

## Backend Endpoints

### New Endpoints

```typescript
// T0: List sessions with summary metadata
GET /sessions
  Query params:
    - start_time, end_time (ISO timestamps)
    - source_app (filter by agent type)
    - repo_name (filter by repository)
    - status (success | error | partial | ongoing)
    - has_critical_events (boolean)
    - limit, offset (pagination)
    - sort_by (recency | severity | duration | cost)
  Response: {
    sessions: [{
      session_id, source_app, repo_name, project_name,
      start_time, end_time, duration_ms,
      status, has_errors, has_hitl,
      event_count, critical_event_count,
      total_cost_usd, model_name,
      // Summary of critical events for quick display
      critical_events_summary: [{ type, count, first_at }]
    }],
    total_count,
    page_info
  }

// T0: Get session with events for timeline rendering
GET /sessions/:id
  Response: {
    session: { ...session metadata },
    events: [{ ...event data with critical flag }],
    critical_events: [{ ...only critical events }]
  }

// T1: Aggregated timeline data for density view
GET /sessions/timeline
  Query params:
    - start_time, end_time
    - bucket_size (hour | day)
    - source_app, repo_name (filters)
  Response: {
    buckets: [{
      start_time, end_time,
      session_count, error_count,
      total_cost, avg_duration
    }]
  }

// T1: Get distinct filter options
GET /sessions/filter-options
  Response: {
    repos: ["ufc-pokedex", "hooks-project", ...],
    source_apps: ["claude", "codex", ...],
    workflows: ["smoke-test", "deploy", ...]
  }
```

### Database Changes

```sql
-- Add indexes for new query patterns
CREATE INDEX idx_sessions_repo ON events(json_extract(environment, '$.repo_name'));
CREATE INDEX idx_sessions_status ON events(session_id, hook_event_type)
  WHERE hook_event_type IN ('SessionEnd', 'Error');

-- Consider a sessions summary table for performance
CREATE TABLE session_summaries (
  session_id TEXT PRIMARY KEY,
  source_app TEXT,
  repo_name TEXT,
  project_name TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_ms INTEGER,
  status TEXT,  -- success, error, partial, ongoing
  has_errors BOOLEAN,
  has_hitl BOOLEAN,
  event_count INTEGER,
  critical_event_count INTEGER,
  total_cost_usd REAL,
  model_name TEXT,
  script_name TEXT,  -- T1
  branch_name TEXT,  -- T2
  config_hash TEXT   -- T2
);
```

---

## Implementation Phases

### Phase 1: T0 Foundation (MVP)
1. Create `HistoryPage.vue` with routing (`/history`)
2. Implement `ZoomableTimeline.vue` with basic zoom/pan
3. Build session bar rendering on timeline
4. Add event markers with critical event highlighting
5. Implement `EventDetailDrawer.vue`
6. Create filter bar (status, source, repo)
7. Add time range selector
8. Build "Failures Only" toggle
9. Create `/sessions` API endpoint
10. Add session summary table to database

### Phase 2: T1 Enhancements
1. Add session cards below timeline
2. Implement density/heatmap view for zoomed-out
3. Add performance hotspots mode
4. Build repo/project grouping
5. Add session search
6. Implement sort options
7. Add workflow/script grouping (for Codex CLI)
8. Create deep links to origin tools
9. Add cost summary display

### Phase 3: T2 Power Features
1. Session comparison view
2. Aggregated statistics dashboard
3. Bookmarks and notes
4. Export/share functionality
5. Regression detection
6. Branch/commit grouping
7. Environment/config snapshots

---

## Open Questions

1. **Timeline library**: D3.js (most flexible) vs extending Canvas (already used)?
2. **Multi-agent lanes**: Separate swim lanes per agent, or intermixed on one timeline?
3. **Session summary generation**: Real-time aggregation vs background job?
4. **Storage**: Keep session_summaries table in sync via triggers or application logic?

---

## Optional Future Ideas (Parking Lot)

These ideas were discussed but deferred:

- [ ] Multi-user support with user filtering
- [ ] Workspace/environment name tracking
- [ ] Full config snapshot storage (not just hash)
- [ ] "Rerun with same parameters" button
- [ ] API webhook for external integrations
- [ ] Session tagging/labeling system
- [ ] Custom critical event rules (user-defined thresholds)
- [ ] Mobile-responsive timeline view
- [ ] Keyboard shortcuts for navigation
- [ ] Session diff (compare changes between two sessions)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-05 01:55 PM | Initial plan created |
| 2025-12-05 01:55 PM | Incorporated ChatGPT feedback: added unit-of-work context (repo, project, workflow), failure-centric workflows, density view, promoted event detail drawer to T0 |
