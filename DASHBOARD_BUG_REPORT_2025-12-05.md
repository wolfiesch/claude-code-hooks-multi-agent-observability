# Dashboard Testing - Bug Report
**Date**: December 5, 2025 04:06 AM
**Testing Method**: Browser automation with Playwright (via Codex CLI)
**Testing Duration**: ~5 minutes
**Dashboard URL**: http://localhost:5173

## 🔴 Critical Bugs

### 1. Model Display Shows "unknown"
**Location**: Session Info Card
**Root Cause**: `.claude/hooks/shared/metadata_collector.py:180`

```python
model = os.environ.get('CLAUDE_MODEL', 'unknown')  # ❌ Claude Code doesn't set this env var!
```

**Issue**: The metadata collector tries to read model name from a `CLAUDE_MODEL` environment variable that Claude Code doesn't provide, causing all sessions to display "unknown" instead of the actual model (Sonnet 4.5, Opus, Haiku, etc.)

**Fix needed**: Either:
- Extract model from the transcript/session data (already available via `model_name` field)
- OR set `CLAUDE_MODEL` in the environment before hooks run
- OR use the already-extracted `model_name` from `send_event.py` line 182

**Files affected**:
- `.claude/hooks/shared/metadata_collector.py:180-189`
- `apps/client/src/components/SessionInfoCard.vue:18` (displays the unknown value)

**Status**: 🔴 Not Fixed

---

## ⚠️ Major UX Issues

### 2. Live Activity Pulse Timeline - Severe Icon Overlap
**Severity**: High - Makes timeline unreadable

**Issue**: Event icons in the pulse chart overlap heavily when there are many events in the time window, making it impossible to:
- Read individual event counts
- Click on specific events
- Distinguish between different event types

**Observed in**: Both 1m and 3m time ranges when multiple agents are active

**Fix needed**:
- Implement timeline clustering/grouping for dense periods
- Add zoom functionality
- Consider showing aggregated counts instead of individual icons when density is high

**Files affected**:
- `apps/client/src/components/LivePulseChart.vue`
- `apps/client/src/utils/chartRenderer.ts`

**Status**: 🔴 Not Fixed

---

### 3. Missing Agent Type / Event Type Filter Dropdowns
**Severity**: Medium - Expected feature not discoverable

**Issue**: The UI only shows:
- Session filter chips
- Regex search box

But missing:
- Agent type dropdown (to filter by claude vs codex vs others)
- Event type dropdown (to filter by PreToolUse, PostToolUse, etc.)

**Current workaround**: Users must manually type regex patterns like `PostToolUse` in search box

**Fix needed**:
- Add explicit filter dropdowns for agent_type and hook_event_type
- Make filter controls more discoverable

**Files affected**:
- `apps/client/src/components/FilterPanel.vue` (likely needs enhancement)

**Status**: 🟡 Not Started

---

### 4. Per-Agent View Shows "0 events / Waiting for events..."
**Severity**: Medium - Data inconsistency

**Issue**: When clicking on an agent chip (e.g., `claude-global:02515ff0`), the per-agent pulse panel displays:
- "0 events"
- "Waiting for events..."

Even though the main timeline clearly shows recent activity for that agent.

**Root cause**: Likely a data filtering or state synchronization issue between the main view and per-agent view

**Fix needed**:
- Debug the per-agent event fetching logic
- Ensure the same data source is used for both views

**Files to investigate**:
- Check how agent chip clicks trigger per-agent views
- Verify event filtering by session_id in client code

**Status**: 🟡 Not Started

---

## ✅ Working Correctly

- **WebSocket connection**: ✅ Live updates working
- **Time range filters**: ✅ 1m, 3m, 5m, 10m buttons all work correctly
- **Session chip filters**: ✅ Clicking session chips filters events
- **Regex search**: ✅ Filtering events by regex works (e.g., `PostToolUse`)
- **Multi-agent tracking**: ✅ Both Claude and Codex sessions visible
- **Console errors**: ✅ None observed during testing
- **Event stream display**: ✅ Events render correctly with proper formatting

---

## 🎯 Recommended Priority

### T0 (Fix First)
1. **Model display bug (#1)** - Quick fix, high visibility issue
2. **Timeline overlap (#2)** - Severe UX problem affecting usability

### T1 (Next)
3. **Missing filter dropdowns (#3)** - Feature gap affecting discoverability
4. **Per-agent view data issue (#4)** - Data consistency problem

---

## 📸 Test Artifacts

Screenshots saved to `/tmp/dashboard-testing/`:
- `main-view.png` - Initial dashboard state with 1m time range
- `filtered-3m.png` - Dashboard with 3m time range showing increased density
- `event-filter.png` - Close-up of event filter and session chips

---

## Testing Notes

**Test execution**: Used Codex CLI with Playwright MCP for automated browser testing
- Navigated to dashboard at http://localhost:5173
- Tested time range switching (1m → 3m)
- Toggled session/agent chips
- Applied regex searches
- Verified console for errors

**Console**: No JavaScript errors logged during testing
**Performance**: Dashboard responsive, updates happen immediately
**Multi-agent support**: Successfully tracked both Claude Code and Codex CLI sessions simultaneously
