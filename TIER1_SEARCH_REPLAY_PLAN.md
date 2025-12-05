# Tier 1 Implementation Plan: Advanced Search & Session Replay

**Features**: #5 Advanced Search & Filtering | #6 Session Replay
**Total Effort**: ~5 hours
**Priority**: Highest
**Status**: Planning

---

## 🎯 Goals

### Feature #5: Advanced Search & Filtering
Transform the dashboard into a powerful investigation tool with:
- Full-text search across all event data
- Regex pattern matching
- Time-range filtering
- Multi-criteria filtering
- Saved filter presets

### Feature #6: Session Replay
Enable time-travel debugging with:
- Chronological event playback
- Speed controls (0.5x, 1x, 2x, 4x)
- Timeline scrubbing
- Jump to specific events
- Pause/resume functionality

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vue)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────────┐     │
│  │  SearchPanel.vue │         │  SessionReplay.vue   │     │
│  │  - Text search   │         │  - Timeline scrubber │     │
│  │  - Regex toggle  │         │  - Speed controls    │     │
│  │  - Time range    │         │  - Event sequencer   │     │
│  │  - Save presets  │         │  - Auto-scroll view  │     │
│  └──────────────────┘         └──────────────────────┘     │
│           │                              │                   │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌─────────────────────────────────────────────────┐       │
│  │           EventList.vue (Enhanced)               │       │
│  │  - Highlight search matches                      │       │
│  │  - Replay mode rendering                         │       │
│  └─────────────────────────────────────────────────┘       │
│                                                               │
└───────────────────────────┬───────────────────────────────┘
                            │
                            │ HTTP / WebSocket
                            │
┌───────────────────────────▼───────────────────────────────┐
│                     Backend (Bun Server)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  New Endpoints:                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  GET /events/search?q=...&regex=...&from=...&to=.. │    │
│  │  GET /events/session/:id (all events for session)  │    │
│  │  GET /filter-presets                                │    │
│  │  POST /filter-presets (save new preset)            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                               │
│  Search Logic:                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  - SQL LIKE / REGEXP for text search               │    │
│  │  - Timestamp range filtering                        │    │
│  │  - Combine with existing filters (agent, type)     │    │
│  │  - Return sorted by timestamp                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SQLite Database                         │
│  - Full-text index on payload, summary, chat columns        │
│  - Optimized queries with EXPLAIN QUERY PLAN               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Phases

### Phase 1: Advanced Search Backend (45 min)

#### 1.1 Database Optimization
**File**: `apps/server/src/db.ts`

Add full-text search index:
```sql
-- Enable FTS5 for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
  id UNINDEXED,
  payload,
  summary,
  chat,
  content='events',
  content_rowid='id'
);

-- Populate FTS table
INSERT INTO events_fts(id, payload, summary, chat)
SELECT id, payload, summary, chat FROM events;

-- Trigger to keep FTS in sync
CREATE TRIGGER events_fts_insert AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(id, payload, summary, chat)
  VALUES (new.id, new.payload, new.summary, new.chat);
END;

CREATE TRIGGER events_fts_update AFTER UPDATE ON events BEGIN
  UPDATE events_fts SET
    payload = new.payload,
    summary = new.summary,
    chat = new.chat
  WHERE id = old.id;
END;

CREATE TRIGGER events_fts_delete AFTER DELETE ON events BEGIN
  DELETE FROM events_fts WHERE id = old.id;
END;
```

#### 1.2 Search Endpoint
**File**: `apps/server/src/index.ts`

```typescript
// GET /events/search
interface SearchParams {
  q?: string;           // Search query
  regex?: boolean;      // Use regex matching
  from?: number;        // Start timestamp (ms)
  to?: number;          // End timestamp (ms)
  agent_type?: string;  // Filter by agent
  event_type?: string;  // Filter by event type
  session_id?: string;  // Filter by session
  limit?: number;       // Max results (default 500)
}

// Example query:
// GET /events/search?q=error&from=1733400000000&to=1733486400000&agent_type=codex
```

**Implementation**:
```typescript
app.get('/events/search', async (c) => {
  const params: SearchParams = {
    q: c.req.query('q'),
    regex: c.req.query('regex') === 'true',
    from: c.req.query('from') ? parseInt(c.req.query('from')!) : undefined,
    to: c.req.query('to') ? parseInt(c.req.query('to')!) : undefined,
    agent_type: c.req.query('agent_type'),
    event_type: c.req.query('event_type'),
    session_id: c.req.query('session_id'),
    limit: parseInt(c.req.query('limit') || '500')
  };

  const results = await searchEvents(params);

  return c.json({
    events: results,
    total: results.length,
    query: params
  });
});
```

#### 1.3 Search Function
**File**: `apps/server/src/db.ts`

```typescript
export function searchEvents(params: SearchParams): Event[] {
  let sql = 'SELECT e.* FROM events e';
  const conditions: string[] = [];
  const values: any[] = [];

  // Full-text search
  if (params.q) {
    if (params.regex) {
      // Use SQLite REGEXP (need to enable)
      sql = `${sql} WHERE (
        e.payload REGEXP ? OR
        e.summary REGEXP ? OR
        e.chat REGEXP ?
      )`;
      values.push(params.q, params.q, params.q);
    } else {
      // Use FTS5
      sql = `${sql}
        JOIN events_fts ON e.id = events_fts.id
        WHERE events_fts MATCH ?`;
      values.push(params.q);
    }
  }

  // Time range
  if (params.from) {
    conditions.push('e.timestamp >= ?');
    values.push(params.from);
  }
  if (params.to) {
    conditions.push('e.timestamp <= ?');
    values.push(params.to);
  }

  // Agent type filter
  if (params.agent_type) {
    conditions.push('e.agent_type = ?');
    values.push(params.agent_type);
  }

  // Event type filter
  if (params.event_type) {
    conditions.push('e.hook_event_type = ?');
    values.push(params.event_type);
  }

  // Session filter
  if (params.session_id) {
    conditions.push('e.session_id = ?');
    values.push(params.session_id);
  }

  // Combine conditions
  if (conditions.length > 0) {
    sql += (params.q ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
  }

  // Sort by timestamp descending
  sql += ' ORDER BY e.timestamp DESC LIMIT ?';
  values.push(params.limit);

  return db.prepare(sql).all(...values) as Event[];
}
```

---

### Phase 2: Advanced Search Frontend (1 hour)

#### 2.1 Search Panel Component
**File**: `apps/client/src/components/SearchPanel.vue`

**Features**:
- Text input with debounce (300ms)
- Regex toggle checkbox
- Time range picker (datepicker or quick buttons: "Last hour", "Today", "Yesterday")
- Combine with existing filters
- Save/load filter presets

**UI Layout**:
```
┌────────────────────────────────────────────────────┐
│  🔍 Search Events                                   │
├────────────────────────────────────────────────────┤
│  [________________Search text________________]  🔎 │
│  [ ] Use regex                                     │
│                                                     │
│  Time Range:                                       │
│  [Last hour] [Today] [Yesterday] [Custom...]      │
│                                                     │
│  Agent Type: [All ▼] Event Type: [All ▼]         │
│                                                     │
│  Saved Filters: [My Presets ▼] [Save Current]    │
└────────────────────────────────────────────────────┘
```

**State Management**:
```typescript
interface SearchState {
  query: string;
  useRegex: boolean;
  timeRange: {
    from: number | null;
    to: number | null;
    preset: 'hour' | 'today' | 'yesterday' | 'custom';
  };
  agentType: string | null;
  eventType: string | null;
  results: Event[];
  loading: boolean;
}
```

#### 2.2 Integration with EventList
**File**: `apps/client/src/components/EventList.vue`

**Enhancements**:
- Highlight search matches in event text
- Show "X results for 'query'" banner
- Clear search button
- Persist search state in URL params

**Match Highlighting**:
```typescript
function highlightMatches(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
```

---

### Phase 3: Session Replay Backend (30 min)

#### 3.1 Session Events Endpoint
**File**: `apps/server/src/index.ts`

```typescript
// GET /events/session/:sessionId
app.get('/events/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  const events = db.prepare(`
    SELECT * FROM events
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as Event[];

  return c.json({
    session_id: sessionId,
    event_count: events.length,
    duration_ms: events.length > 0
      ? events[events.length - 1].timestamp - events[0].timestamp
      : 0,
    events
  });
});
```

---

### Phase 4: Session Replay Frontend (2.5 hours)

#### 4.1 Replay Controller Component
**File**: `apps/client/src/components/SessionReplay.vue`

**UI Layout**:
```
┌──────────────────────────────────────────────────────────┐
│  Session Replay: claude:3b180584                          │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  SessionStart → PreToolUse → Bash → PostToolUse   │ │
│  │  ▶  [===============●===================]  ✓        │ │
│  │  0:00                2:34               5:12        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                            │
│  [◀◀] [▶/⏸] [▶▶]  Speed: [0.5x] [1x] [2x] [4x]        │
│                                                            │
│  Current Event (15/42):                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  🔧 PreToolUse - Bash                               │ │
│  │  Timestamp: 2025-12-05 04:30:15                    │ │
│  │  Command: ls -la                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Features**:
1. **Timeline Scrubber**
   - Visual bar showing all events
   - Click/drag to jump to specific time
   - Event markers as dots on timeline
   - Current position indicator

2. **Playback Controls**
   - Play/Pause button
   - Step forward/backward (one event at a time)
   - Speed selector (0.5x, 1x, 2x, 4x)
   - Progress percentage

3. **Event Display**
   - Show current event details
   - Auto-scroll to current event in main list
   - Highlight current event

**State Management**:
```typescript
interface ReplayState {
  sessionId: string;
  events: Event[];
  currentIndex: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  startTime: number;
  totalDuration: number;
}
```

#### 4.2 Replay Engine
**File**: `apps/client/src/composables/useReplay.ts`

```typescript
export function useReplay(events: Event[]) {
  const state = reactive<ReplayState>({
    events,
    currentIndex: 0,
    isPlaying: false,
    speed: 1,
    startTime: events[0]?.timestamp || 0,
    totalDuration: events.length > 0
      ? events[events.length - 1].timestamp - events[0].timestamp
      : 0
  });

  let intervalId: number | null = null;

  function play() {
    if (state.isPlaying) return;
    state.isPlaying = true;

    const baseDelay = 100; // ms between checks

    intervalId = setInterval(() => {
      if (state.currentIndex >= state.events.length - 1) {
        pause();
        return;
      }

      const currentEvent = state.events[state.currentIndex];
      const nextEvent = state.events[state.currentIndex + 1];
      const realDelay = nextEvent.timestamp - currentEvent.timestamp;
      const scaledDelay = realDelay / state.speed;

      if (scaledDelay <= baseDelay) {
        state.currentIndex++;
      }
    }, baseDelay);
  }

  function pause() {
    state.isPlaying = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function seekTo(index: number) {
    pause();
    state.currentIndex = Math.max(0, Math.min(index, state.events.length - 1));
  }

  function stepForward() {
    pause();
    if (state.currentIndex < state.events.length - 1) {
      state.currentIndex++;
    }
  }

  function stepBackward() {
    pause();
    if (state.currentIndex > 0) {
      state.currentIndex--;
    }
  }

  function setSpeed(speed: 0.5 | 1 | 2 | 4) {
    const wasPlaying = state.isPlaying;
    pause();
    state.speed = speed;
    if (wasPlaying) play();
  }

  return {
    state,
    play,
    pause,
    seekTo,
    stepForward,
    stepBackward,
    setSpeed
  };
}
```

---

## 🧪 Testing Strategy

### Advanced Search Testing
```typescript
// Test cases
1. Search for "error" → Should find all events with "error" in payload/summary
2. Regex search for "error.*timeout" → Should find error + timeout patterns
3. Time range: Today → Should only show today's events
4. Combined: agent_type=codex + event_type=TaskComplete → Should filter correctly
5. Empty search → Should return all events (or show message)
6. No results → Should show "No results found" message
```

### Session Replay Testing
```typescript
// Test cases
1. Load session with 50 events → Should show all events in order
2. Play → Events should advance automatically
3. Pause → Should stop at current event
4. Speed 2x → Should advance twice as fast
5. Scrub timeline → Should jump to clicked position
6. Step forward/backward → Should move one event at a time
7. Replay completed session → Should show full history
8. Session with no events → Should show "No events to replay"
```

---

## 📦 Deliverables

### Advanced Search (#5)
- ✅ Full-text search with FTS5
- ✅ Regex pattern matching
- ✅ Time-range filtering
- ✅ Multi-criteria filtering
- ✅ Search highlights in results
- ✅ Saved filter presets (localStorage)

### Session Replay (#6)
- ✅ Timeline scrubber with event markers
- ✅ Play/pause controls
- ✅ Variable speed (0.5x - 4x)
- ✅ Step forward/backward
- ✅ Current event highlighting
- ✅ Progress indicator
- ✅ Auto-scroll during playback

---

## 🗓️ Implementation Order

### Day 1: Search (3 hours)
1. **Hour 1**: Backend search endpoint + FTS5 setup
2. **Hour 2**: SearchPanel.vue component
3. **Hour 3**: Integration, highlighting, saved presets

### Day 2: Replay (3 hours)
1. **Hour 1**: Session endpoint + replay composable
2. **Hour 2**: SessionReplay.vue UI + controls
3. **Hour 3**: Timeline scrubber + polish

**Total**: 5-6 hours across two sessions

---

## 🚀 Success Metrics

After implementation:

**Search Effectiveness**:
- ✅ Find any event in < 2 seconds
- ✅ Search 10,000+ events without lag
- ✅ Regex patterns work correctly
- ✅ Time-range filtering is accurate

**Replay Usability**:
- ✅ Smooth playback with no stuttering
- ✅ Timeline scrubbing is responsive
- ✅ Speed controls feel natural
- ✅ Current event is always visible

---

## 💡 Future Enhancements (Out of Scope)

- Export replay as animated GIF/video
- Multi-session parallel replay
- Replay annotations (add notes at specific times)
- Share replay via URL
- Replay bookmarks (mark interesting moments)

---

**Status**: IMPLEMENTED
**Last Updated**: 2025-12-05 05:45 AM PST

---

## Implementation Changelog

### 2025-12-05 05:45 AM PST - Implementation Complete
- **Phase 1 (Search Backend)**: Added FTS5 virtual table with triggers for sync, `searchEvents()` function with FTS5 + fallback LIKE search
- **Phase 2 (Search Frontend)**: Created `SearchPanel.vue` with text search, time range buttons, agent/event type filters
- **Phase 3 (Replay Backend)**: Added `getSessionEvents()` function and `/events/session/:id` endpoint
- **Phase 4 (Replay Frontend)**: Created `useReplay.ts` composable and `SessionReplay.vue` with timeline scrubber, play/pause, step controls
- **Integration**: Added search and replay buttons to App.vue header, modal for session replay

### Deferred Features (marked as [TODO] in code)
- Regex pattern matching support (SearchPanel.vue line 113)
- Saved filter presets (SearchPanel.vue line 115)
- Speed controls for replay (v2 feature)
