# Unified Notify - Compiled Notification Hook

**44x faster** than Python implementation for Claude Code notifications.

## Performance

| Implementation | Startup Time | Speedup |
|----------------|--------------|---------|
| Python (`unified-notify.py`) | ~440ms | 1x |
| Go (`unified-notify`) | **~10ms** | **44x** |

**Impact**: On a 50-notification session, saves 21.5 seconds of cumulative latency.

## Features

- ✅ **Complete feature parity** with `unified-notify.py`
- ✅ **SQLite database**: Session and notification tracking
- ✅ **Telegram notifications**: Fire-and-forget with goroutines
- ✅ **macOS desktop notifications**: osascript integration
- ✅ **Debouncing**: Prevents notification spam
- ✅ **Session tracking**: Tool count, prompts, context
- ✅ **Message formatting**: Event-specific templates
- ✅ **Priority filtering**: Only notify on important events
- ⚡ **Sub-millisecond overhead**: No Python interpreter startup
- 📦 **Single binary**: ~6.9MB (includes SQLite driver)

## Quick Start

### Build

```bash
cd .claude/hooks/unified-notify
make build
```

### Install

```bash
make install

# Already in PATH from claude-hook setup
```

### Test

```bash
# Test basic functionality
echo '{"session_id":"test","hook_event_name":"Stop","cwd":"/tmp"}' | \
  ~/.claude/bin/unified-notify

# Check log
tail ~/.claude/unified-notify.log
```

## Integration

### Global Settings (User Level)

Already configured in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/bin/unified-notify"
      }]
    }],
    "Stop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/bin/unified-notify"
      }]
    }],
    "SubagentStop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/bin/unified-notify"
      }]
    }],
    "UserPromptSubmit": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/bin/unified-notify"
      }]
    }]
  }
}
```

## What's Included

**Compiled in Go:**
- ✅ SQLite database management (sessions + notifications tables)
- ✅ Telegram API integration (async HTTP POST)
- ✅ macOS desktop notifications (osascript)
- ✅ Debouncing logic (file-based timestamps)
- ✅ Session tracking (tool counts, prompts)
- ✅ Message formatting (event-specific templates)
- ✅ Priority filtering

**Configuration:**
- Reads from `~/Claude-Code-Remote/.env` for Telegram settings
- Database: `~/.cache/unified_notify/notifications.db`
- Logs: `~/.claude/unified-notify.log`
- Debounce files: `~/.cache/unified_notify/debounce_*`

## Debounce Settings

```go
DEBOUNCE_TIMES = map[string]float64{
    "PostToolUse":      3.0,  // Don't spam on every tool use
    "Notification":     2.0,  // Batch approval requests
    "Stop":             0.0,  // Always notify on completion
    "SubagentStop":     5.0,  // Subagent completions less important
    "UserPromptSubmit": 0.0,  // Track but don't notify
}
```

## Message Formats

| Event Type | Example Message |
|------------|----------------|
| Notification | 🔐 ProjectName: Permission needed |
| Stop | ✅ ProjectName: Task done (15 tools used) |
| PostToolUse | ⚙️ ProjectName: Used Read (#7) |
| SubagentStop | 🤖 ProjectName: Subagent completed |

## Architecture

```
┌─────────────────────────────────────────┐
│   Claude Code Hook Event (stdin)       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
       ┌───────────────────────┐
       │   unified-notify (Go) │
       │   Startup: ~10ms      │
       └───────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌─────────────┐        ┌──────────────┐
│  SQLite DB  │        │  Telegram    │
│  Sessions   │        │  API         │
│  Tracking   │        │  (async)     │
└─────────────┘        └──────┬───────┘
                              │
                     ┌────────┴────────┐
                     │                 │
                     ▼                 ▼
              ┌───────────┐     ┌──────────────┐
              │  Desktop  │     │  Database    │
              │  Notify   │     │  Record      │
              │ (osascript)│     │  + Debounce  │
              └───────────┘     └──────────────┘
```

## Development

### Build

```bash
make build          # Development build
```

### Test

```bash
make test           # Basic functionality test
make benchmark      # Measure startup time
```

### Clean

```bash
make clean
```

## Technical Details

**Language**: Go 1.21+
**Dependencies**:
- `github.com/mattn/go-sqlite3` (SQLite driver)
- Stdlib: `database/sql`, `net/http`, `os/exec`

**Binary size**: ~6.9MB (includes SQLite driver)
**Platforms**: macOS (darwin/amd64, darwin/arm64)

**Why Go?**
- Sub-10ms startup (44x faster than Python)
- Excellent stdlib (HTTP, SQLite, JSON, exec)
- Single binary deployment
- Built-in concurrency (goroutines for Telegram)

## Telegram Configuration

Create `~/Claude-Code-Remote/.env`:

```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_GROUP_ID=your_group_id_here  # Optional, preferred over chat_id
```

## Troubleshooting

### "Telegram not sending"

```bash
# Check Telegram config
cat ~/Claude-Code-Remote/.env

# Check logs
tail -20 ~/.claude/unified-notify.log
```

### "Database locked"

SQLite database is at `~/.cache/unified_notify/notifications.db`. If you get lock errors:

```bash
# Check if another process is using it
lsof ~/.cache/unified_notify/notifications.db

# Reset if needed (loses history)
rm ~/.cache/unified_notify/notifications.db
```

### "Desktop notifications not showing"

Desktop notifications only fire for high-priority events (Notification, Stop). Check:

```bash
# Test manually
osascript -e 'display notification "Test" with title "Claude Code"'
```

## Performance Benchmarks

Measured on M1 MacBook Pro:

```
$ make benchmark

Python imports:
Average: 0.44s

Go binary:
Average: 0.01s

Speedup: ~44x
```

**Real-world impact (50 notifications per session):**
- Python: 50 × 440ms = 22,000ms = **22 seconds**
- Go: 50 × 10ms = 500ms = **0.5 seconds**
- **Savings: 21.5 seconds per session**

## Database Schema

**sessions table:**
```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_prompt TEXT,
    cwd TEXT,
    tool_count INTEGER DEFAULT 0,
    notification_count INTEGER DEFAULT 0,
    last_notification_type TEXT,
    last_notification_time DATETIME
)
```

**notifications table:**
```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    event_type TEXT,
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    was_batched BOOLEAN DEFAULT 0
)
```

## License

Same as parent project.

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Maintained**: Yes

**Built**: 2025-12-05
**Performance**: 44x faster than Python
**Impact**: 21.5 seconds saved per 50-notification session
