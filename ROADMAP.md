# 🚀 Multi-Agent Observability System Roadmap

**Project**: Claude Code Multi-Agent Observability System
**Status**: Active Development
**Last Updated**: 2025-12-05

---

## 🎯 Tier 0: Immediate Priorities

High-impact improvements ready for immediate implementation.

### 1. One-Command Global Installer

**Impact**: 🔥 High | **Effort**: ⚡ Low (30 min) | **Status**: 🟡 Planned

#### Problem
Current installation requires manual steps:
- Copy files to `~/.local/bin/codex-observability/`
- Create symlinks manually
- Edit shell config files
- No validation of installation

#### Solution
Create automated installation script that handles everything.

#### Implementation

**File**: `scripts/install-global-tracking.sh`

```bash
#!/bin/bash
#
# One-command global installation for Codex observability tracking
# Usage: ./scripts/install-global-tracking.sh
#

set -e

echo "🚀 Installing Codex Observability Tracking..."

# Configuration
INSTALL_DIR="$HOME/.local/bin/codex-observability"
BIN_DIR="$HOME/.local/bin"
SHELL_CONFIG="$HOME/.zshrc"

# Detect shell config file
if [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
fi

# Create installation directory
echo "📁 Creating installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Copy files
echo "📋 Copying files..."
cp .claude/hooks/codex-tracked "$INSTALL_DIR/"
cp .claude/hooks/codex_wrapper.ts "$INSTALL_DIR/"
cp .claude/hooks/send_event.py "$INSTALL_DIR/"
cp -r .claude/hooks/utils "$INSTALL_DIR/"

# Make executable
chmod +x "$INSTALL_DIR/codex-tracked"

# Create symlink
echo "🔗 Creating symlink..."
ln -sf "$INSTALL_DIR/codex-tracked" "$BIN_DIR/codex-tracked"

# Add to PATH if not already present
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_CONFIG"; then
    echo "" >> "$SHELL_CONFIG"
    echo '# Codex Observability Tracking' >> "$SHELL_CONFIG"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
    echo "✅ Added $BIN_DIR to PATH in $SHELL_CONFIG"
fi

# Offer to create alias
echo ""
read -p "❓ Create alias 'codex=codex-tracked' for automatic tracking? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! grep -q 'alias codex="codex-tracked"' "$SHELL_CONFIG"; then
        echo 'alias codex="codex-tracked"' >> "$SHELL_CONFIG"
        echo "✅ Created alias in $SHELL_CONFIG"
    else
        echo "ℹ️  Alias already exists"
    fi
fi

# Validation
echo ""
echo "🔍 Validating installation..."

if [ -x "$BIN_DIR/codex-tracked" ]; then
    echo "✅ codex-tracked is executable"
else
    echo "❌ ERROR: codex-tracked is not executable"
    exit 1
fi

if [ -f "$INSTALL_DIR/codex_wrapper.ts" ]; then
    echo "✅ codex_wrapper.ts found"
else
    echo "❌ ERROR: codex_wrapper.ts missing"
    exit 1
fi

if [ -f "$INSTALL_DIR/send_event.py" ]; then
    echo "✅ send_event.py found"
else
    echo "❌ ERROR: send_event.py missing"
    exit 1
fi

if [ -d "$INSTALL_DIR/utils" ]; then
    echo "✅ utils directory found"
else
    echo "❌ ERROR: utils directory missing"
    exit 1
fi

# Success message
echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Reload your shell: source $SHELL_CONFIG"
echo "   2. Start the observability server: cd apps/server && bun src/index.ts"
echo "   3. Test tracking: codex-tracked exec -m gpt-5.1-codex-max 'echo test'"
echo "   4. View dashboard: http://localhost:5174"
echo ""
echo "🎉 You can now track Codex from ANY repository!"
```

#### Testing
```bash
# Test installation
./scripts/install-global-tracking.sh

# Verify in new terminal
which codex-tracked  # Should show ~/.local/bin/codex-tracked

# Test from different repo
cd ~/some-other-project
codex-tracked exec -m gpt-5.1-codex-max "echo 'Cross-repo test'"

# Check dashboard for events
open http://localhost:5174
```

#### Benefits
- **10x easier adoption** - Single command vs 5+ manual steps
- **Error-free setup** - Automated validation catches issues
- **Better UX** - Interactive prompts for optional features
- **Cross-platform** - Detects bash/zsh automatically

---

### 2. Health Check Endpoint

**Impact**: 🔥 Medium | **Effort**: ⚡ Low (20 min) | **Status**: 🟡 Planned

#### Problem
No way to:
- Check if server is running
- Monitor database growth
- See active session count
- Verify system health

#### Solution
Add `/health` endpoint returning comprehensive system status.

#### Implementation

**File**: `apps/server/src/index.ts`

Add this route:

```typescript
// Health check endpoint
app.get('/health', async (c) => {
  try {
    // Get database stats
    const dbSize = await db.get(`
      SELECT page_count * page_size as size
      FROM pragma_page_count(), pragma_page_size()
    `);

    const eventCount = await db.get(`
      SELECT COUNT(*) as count FROM events
    `);

    const sessionCount = await db.get(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM events
      WHERE timestamp > ?
    `, Date.now() - 24 * 60 * 60 * 1000); // Last 24h

    const recentEvents = await db.get(`
      SELECT COUNT(*) as count
      FROM events
      WHERE timestamp > ?
    `, Date.now() - 60 * 1000); // Last minute

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        uptime_ms: process.uptime() * 1000,
        version: '1.0.0'
      },
      database: {
        size_bytes: dbSize?.size || 0,
        size_mb: ((dbSize?.size || 0) / 1024 / 1024).toFixed(2),
        total_events: eventCount?.count || 0,
        active_sessions_24h: sessionCount?.count || 0,
        events_last_minute: recentEvents?.count || 0
      },
      websocket: {
        connected_clients: wss.clients.size
      }
    });
  } catch (error) {
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
```

#### Usage
```bash
# Check health
curl http://localhost:4000/health | jq

# Monitor in watch mode
watch -n 5 'curl -s http://localhost:4000/health | jq'

# Use in scripts
if curl -sf http://localhost:4000/health > /dev/null; then
  echo "Server is healthy"
else
  echo "Server is down!"
fi
```

#### Response Example
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T01:30:00.000Z",
  "server": {
    "uptime_ms": 3600000,
    "version": "1.0.0"
  },
  "database": {
    "size_bytes": 1048576,
    "size_mb": "1.00",
    "total_events": 1542,
    "active_sessions_24h": 12,
    "events_last_minute": 3
  },
  "websocket": {
    "connected_clients": 2
  }
}
```

#### Benefits
- **Monitoring** - Easy health checks for uptime monitoring
- **Debugging** - Quickly see if server is responding
- **Metrics** - Database growth, session activity at a glance
- **DevOps** - Standard endpoint for load balancers/orchestrators

---

## 📊 Tier 1: High-Value Features (1-3 hours each)

### 3. Session Comparison View
**Impact**: High | **Effort**: Low (1 hour)
- Side-by-side comparison of two sessions
- Diff view for different approaches
- Performance comparison (speed, tokens, cost)

### 4. Cost Budget Alerts
**Impact**: High | **Effort**: Low (45 min)
```javascript
// Alert when daily/weekly spend exceeds threshold
if (dailyCost > BUDGET_THRESHOLD) {
  notify("Budget exceeded: $50/$40")
}
```

### 5. Advanced Search & Filtering
**Current**: Basic dropdowns
**Enhanced**:
- Full-text search across all events
- Regex support for payload search
- Time-range filtering (last hour, today, custom)
- Saved filter presets

### 6. Session Replay
**Impact**: Very High | **Effort**: Medium
- Replay a session's events chronologically
- Pause/play/speed controls
- See exactly what happened when
- Jump to specific events

### 7. Real-Time Metrics Dashboard
**Impact**: High | **Effort**: Medium
```
┌─────────────────────────────────────┐
│ Active Sessions: 3                  │
│ Events/min: 12                      │
│ Avg Response Time: 450ms            │
│ Today's Cost: $2.34                 │
│ Error Rate: 0.5%                    │
└─────────────────────────────────────┘
```

### 8. Agent Performance Comparison
**Impact**: High | **Effort**: Medium
- Claude vs Codex side-by-side stats
- Success rates, average duration, cost per task
- Best agent recommendation for task types

### 9. Export & Share Sessions
**Impact**: Medium | **Effort**: Medium
```bash
# Export session to shareable format
GET /sessions/{id}/export
# Returns: JSON/CSV/HTML report

# Share via URL
https://dashboard.local/shared/{session_id}
```

---

## 🎨 Tier 2: Dashboard Enhancements (3-5 hours each)

### 10. Timeline View (Gantt Chart)
**Impact**: Very High | **Effort**: Medium
```
Session A  |====TaskStart====|------|====TaskComplete====|
Session B    |===TaskStart===|------------|===TaskComplete===|
           0s     5s    10s    15s    20s    25s    30s
```
Shows overlapping agent work, parallel execution

### 11. Event Dependency Graph
**Impact**: High | **Effort**: High
```
UserPrompt → PreToolUse → Bash → PostToolUse → Codex TaskStart
                                                   ↓
                                           Codex TaskComplete
```
Visual flow of agent interactions

### 12. Custom Event Annotations
**Impact**: Medium | **Effort**: Medium
- Add notes/tags to events
- Mark interesting patterns
- Bookmark important sessions
- Team collaboration on debugging

### 13. Dark/Light Theme Toggle
**Impact**: Low | **Effort**: Low
- User preference persistence
- Auto-detect system theme

---

## 🔧 Tier 3: Advanced Features (5+ hours each)

### 14. Multiple Server Support
**Impact**: High | **Effort**: Medium
```bash
# Different environments
export OBSERVABILITY_SERVER="http://prod-dashboard:4000"
export OBSERVABILITY_SERVER="http://localhost:4000"

# Team server vs local development
codex-tracked --server prod exec "task"
codex-tracked --server local exec "task"
```

### 15. Agent Orchestration View
**Impact**: Very High | **Effort**: High
```
Claude (Main)
  ├─> Codex (Task 1) ─> Complete
  ├─> Codex (Task 2) ─> In Progress
  └─> Claude (Review) ─> Pending

Shows parent-child agent relationships
```

### 16. Real-Time Collaboration
**Impact**: High | **Effort**: High
- Multiple users viewing same dashboard
- Live cursor positions
- Shared filters
- Team chat/annotations

### 17. Historical Analytics
**Impact**: High | **Effort**: High
```
Weekly Summary:
- Total sessions: 142
- Most used agent: Claude (85%) vs Codex (15%)
- Average task duration: 23s
- Total cost: $87.50
- Peak usage: Tuesday 2-4pm

Trends: Task completion up 15% vs last week
```

### 18. Agent Communication Protocol
**Impact**: Very High | **Effort**: Very High
- Track when Claude hands off to Codex
- Capture handoff context/instructions
- Show communication flow
- Measure handoff efficiency

### 19. Smart Notifications
**Impact**: Medium | **Effort**: Medium
```javascript
// Configurable alerts
- Agent error occurred → Slack/Email
- Long-running task (>5 min) → Desktop notification
- Daily cost report → Email digest
- Session completed → Webhook
```

### 20. Resource Usage Tracking
**Impact**: High | **Effort**: High
```javascript
{
  cpu_percent: 45,
  memory_mb: 256,
  disk_io_mb: 12,
  network_kb: 850,
  duration_ms: 15000
}
```
Track system resources during agent execution

---

## 🌟 Tier 4: Moonshots (10+ hours)

### 21. AI-Powered Insights
**Impact**: Very High | **Effort**: Very High
```
🤖 Insight: "Claude typically completes this task type
30% faster than Codex. Consider using Claude for similar tasks."

🤖 Warning: "This task has failed 3 times with similar
errors. Suggested fix: Update API credentials."
```

### 22. Mobile Dashboard App
**Impact**: High | **Effort**: Very High
- React Native or Flutter app
- Real-time push notifications
- Monitor agents on the go
- Quick session review

### 23. Plugin System
**Impact**: Very High | **Effort**: Very High
```javascript
// Custom visualizations, integrations
plugins/
  ├── slack-notifications/
  ├── jira-integration/
  ├── custom-charts/
  └── cost-optimizer/
```

### 24. Session Recording/Replay
**Impact**: Very High | **Effort**: Very High
- Full terminal recording
- Step-through debugging
- Time-travel debugging
- Reproduce issues exactly

### 25. Multi-Tenant Support
**Impact**: High | **Effort**: Very High
- Teams/organizations
- Role-based access control
- Shared dashboards
- Usage quotas

---

## 🎬 Implementation Phases

### Phase 1: Foundation (This Week)
**Focus**: Core usability improvements
- ✅ One-command installer script
- ✅ Health check endpoint

**Deliverables**:
- `scripts/install-global-tracking.sh`
- `/health` endpoint in server
- Updated documentation

### Phase 2: User Experience (Next 1-2 Weeks)
**Focus**: Search, comparison, and visualization
- Session comparison view
- Cost budget alerts
- Advanced search & filtering
- Session replay

**Deliverables**:
- Session comparison UI component
- Budget tracking system
- Enhanced search interface
- Replay controls

### Phase 3: Insights & Analytics (Next Month)
**Focus**: Understanding agent behavior
- Real-time metrics dashboard
- Agent performance comparison
- Timeline view (Gantt chart)
- Export & share sessions

**Deliverables**:
- Metrics aggregation system
- Performance comparison tools
- Timeline visualization
- Export functionality

### Phase 4: Collaboration & Scale (Future)
**Focus**: Team features and advanced capabilities
- Agent orchestration view
- Real-time collaboration
- Historical analytics
- Smart notifications

**Deliverables**:
- Multi-user support
- Notification system
- Analytics engine
- Agent hierarchy visualization

### Phase 5: Advanced Platform (Long-term)
**Focus**: AI insights and extensibility
- AI-powered insights
- Plugin system
- Mobile dashboard app
- Multi-tenant support

**Deliverables**:
- AI insights engine
- Plugin architecture
- Mobile apps (iOS/Android)
- Enterprise features

---

## 💡 Prioritization Framework

Features are prioritized based on:

1. **Impact** (High/Medium/Low)
   - User value delivered
   - Problem severity addressed
   - Adoption enablement

2. **Effort** (Low/Medium/High/Very High)
   - Implementation time
   - Technical complexity
   - Dependencies

3. **Risk** (Low/Medium/High)
   - Technical uncertainty
   - Breaking changes
   - Performance impact

**Quick Wins** = High Impact + Low Effort + Low Risk

---

## 📋 Testing Checklist

Before marking features as complete:

### Tier 0
- [ ] Test installer on fresh system
- [ ] Verify cross-repo tracking works
- [ ] Test health endpoint returns valid data
- [ ] Verify health endpoint error handling

### Tier 1+
- [ ] Unit tests for new components
- [ ] Integration tests for API endpoints
- [ ] UI component tests
- [ ] Performance benchmarks
- [ ] Cross-browser testing
- [ ] Mobile responsiveness
- [ ] Accessibility compliance

---

## 🚀 Current Focus

**Active Work**: Tier 0 - Foundation
**Next Up**: Implementation of installer and health endpoint

**Completed**:
- ✅ Core observability system
- ✅ Claude Code hook integration
- ✅ Codex CLI wrapper with tracking
- ✅ Real-time dashboard with WebSocket streaming
- ✅ Cross-repo tracking architecture
- ✅ Cost tracking and token usage monitoring

**In Progress**:
- 🟡 One-command global installer
- 🟡 Health check endpoint

---

## 📖 Documentation

Related documents:
- `README.md` - Project overview and setup
- `TIER0_METADATA.md` - Tier 0 metadata details
- `TIER1_IMPLEMENTATION.md` - Tier 1 implementation notes
- `DASHBOARD_UI_COMPLETE.md` - Dashboard UI completion status
- `CODE_REVIEW_AND_T0_FIXES.md` - Code review findings

---

**Document Status**: Active Development
**Last Updated**: 2025-12-05 01:40 AM PST
