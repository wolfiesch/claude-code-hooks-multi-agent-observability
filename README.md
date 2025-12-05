# Multi-Agent Observability System

Real-time monitoring and visualization for Claude Code agents through comprehensive hook event tracking. You can watch the [full breakdown here](https://youtu.be/9ijnN985O_c) and watch the latest enhancement where we compare Haiku 4.5 and Sonnet 4.5 [here](https://youtu.be/aA9KP7QIQvM).

## 🎯 Overview

This system provides complete observability into Claude Code agent behavior by capturing, storing, and visualizing Claude Code [Hook events](https://docs.anthropic.com/en/docs/claude-code/hooks) in real-time. It enables monitoring of multiple concurrent agents with session tracking, event filtering, and live updates.

<img src="images/app.png" alt="Multi-Agent Observability Dashboard" style="max-width: 800px; width: 100%;">

## ✨ What's New - Tier 0 Enhancements

**Recent improvements for easier adoption and system monitoring:**

### 🚀 One-Command Codex Installer
Install Codex observability tracking globally with a single command:
```bash
./scripts/install-global-tracking.sh
```
- Automated setup with validation
- Cross-repo tracking from any directory
- Interactive alias configuration
- No more manual file copying!

### 🏥 Health Check Endpoint
Monitor system health and performance:
```bash
curl http://localhost:4000/health | jq
```
Returns:
- Server uptime and version
- Database size and event count
- Active sessions (24h)
- Events per minute
- WebSocket client connections

See [ROADMAP.md](./ROADMAP.md) for upcoming features and the full enhancement roadmap.

## 🏗️ Architecture

```
Claude Agents → Hook Scripts → HTTP POST → Bun Server → SQLite → WebSocket → Vue Client
```

![Agent Data Flow Animation](images/AgentDataFlowV2.gif)

## 📋 Setup Requirements

Before getting started, ensure you have the following installed:

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI for Claude
- **[Astral uv](https://docs.astral.sh/uv/)** - Fast Python package manager (required for hook scripts)
- **[Bun](https://bun.sh/)**, **npm**, or **yarn** - For running the server and client
- **Anthropic API Key** - Set as `ANTHROPIC_API_KEY` environment variable
- **OpenAI API Key** (optional) - For multi-model support with just-prompt MCP tool
- **ElevenLabs API Key** (optional) - For audio features
- **[Go 1.21+](https://go.dev/dl/)** (optional) - For 17x faster compiled hooks

### Configure .claude Directory

To setup observability in your repo,we need to copy the .claude directory to your project root.

To integrate the observability hooks into your projects:

1. **Copy the entire `.claude` directory to your project root:**
   ```bash
   cp -R .claude /path/to/your/project/
   ```

2. **Update the `settings.json` configuration:**
   
   Open `.claude/settings.json` in your project and modify the `source-app` parameter to identify your project:
   
   ```json
   {
     "hooks": {
       "PreToolUse": [{
         "matcher": "",
         "hooks": [
           {
             "type": "command",
             "command": "uv run .claude/hooks/pre_tool_use.py"
           },
           {
             "type": "command",
             "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse --summarize"
           }
         ]
       }],
       "PostToolUse": [{
         "matcher": "",
         "hooks": [
           {
             "type": "command",
             "command": "uv run .claude/hooks/post_tool_use.py"
           },
           {
             "type": "command",
             "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type PostToolUse --summarize"
           }
         ]
       }],
       "UserPromptSubmit": [{
         "hooks": [
           {
             "type": "command",
             "command": "uv run .claude/hooks/user_prompt_submit.py --log-only"
           },
           {
             "type": "command",
             "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type UserPromptSubmit --summarize"
           }
         ]
       }]
       // ... (similar patterns for Notification, Stop, SubagentStop, PreCompact, SessionStart, SessionEnd)
     }
   }
   ```
   
   Replace `YOUR_PROJECT_NAME` with a unique identifier for your project (e.g., `my-api-server`, `react-app`, etc.).

3. **Ensure the observability server is running:**
   ```bash
   # From the observability project directory (this codebase)
   ./scripts/start-system.sh
   ```

Now your project will send events to the observability system whenever Claude Code performs actions.

### Global Cross-Repo Tracking (Recommended)

To track Claude Code agents **across all repositories** on your machine (including sub-agents launched in other repos), configure global hooks:

**Why Global Hooks?**
- ✅ Track agents in **every repository** automatically
- ✅ Monitor sub-agents launched by Task tool in different repos
- ✅ Capture model information from any Claude Code session
- ✅ Centralized hook management (no need to copy `.claude/` to each project)

**Automated Setup (Recommended):**

```bash
# Run the setup script from this project directory
./scripts/setup-global-hooks.sh
```

The script will:
- ✅ Automatically backup your existing global settings
- ✅ Merge observability hooks with any existing global hooks
- ✅ Use absolute paths (no manual path replacement needed)
- ✅ Safely handle existing configurations

**Manual Setup:**

1. **Edit your global Claude Code settings** (`~/.claude/settings.json`):

   Add observability hooks that point to this project's scripts:

   ```json
   {
     "hooks": {
       "SessionStart": [{
         "matcher": ".*",
         "hooks": [{
           "type": "command",
           "command": "uv run /ABSOLUTE/PATH/TO/claude-code-hooks-multi-agent-observability/.claude/hooks/send_event.py --source-app claude-global --event-type SessionStart"
         }]
       }],
       "PreToolUse": [{
         "matcher": ".*",
         "hooks": [{
           "type": "command",
           "command": "uv run /ABSOLUTE/PATH/TO/claude-code-hooks-multi-agent-observability/.claude/hooks/send_event.py --source-app claude-global --event-type PreToolUse --summarize"
         }]
       }],
       "PostToolUse": [{
         "matcher": ".*",
         "hooks": [{
           "type": "command",
           "command": "uv run /ABSOLUTE/PATH/TO/claude-code-hooks-multi-agent-observability/.claude/hooks/send_event.py --source-app claude-global --event-type PostToolUse --summarize"
         }]
       }],
       "Stop": [{
         "matcher": ".*",
         "hooks": [{
           "type": "command",
           "command": "uv run /ABSOLUTE/PATH/TO/claude-code-hooks-multi-agent-observability/.claude/hooks/send_event.py --source-app claude-global --event-type Stop"
         }]
       }],
       "SubagentStop": [{
         "matcher": ".*",
         "hooks": [{
           "type": "command",
           "command": "uv run /ABSOLUTE/PATH/TO/claude-code-hooks-multi-agent-observability/.claude/hooks/send_event.py --source-app claude-global --event-type SubagentStop"
         }]
       }]
     }
   }
   ```

   Replace `/ABSOLUTE/PATH/TO/` with the full path to this project directory.

2. **Backup existing global settings** (if any):
   ```bash
   cp ~/.claude/settings.json ~/.claude/settings.json.backup
   ```

3. **Merge with existing hooks** (if you have other global hooks):

   Global hooks and project-specific hooks work together. If you already have hooks in `~/.claude/settings.json`, add the observability hooks to the existing hook arrays rather than replacing them.

**How It Works:**

Claude Code merges hooks from multiple configuration levels:
```
Global (~/.claude/settings.json)
  ↓ merged with ↓
Project (.claude/settings.json)
  ↓ all hooks execute ↓
Observability Dashboard
```

**Now every Claude Code agent on your machine** (main session or sub-agent) will automatically send events to the dashboard, regardless of which repository it's running in!

## 🚀 Quick Start

You can quickly view how this works by running this repositories .claude setup.

```bash
# 1. Start both server and client
./scripts/start-system.sh

# 2. Open http://localhost:5173 in your browser

# 3. Open Claude Code and run the following command:
Run git ls-files to understand the codebase.

# 4. Watch events stream in the client

# 5. Copy the .claude folder to other projects you want to emit events from.
cp -R .claude <directory of your codebase you want to emit events from>
```

## 📁 Project Structure

```
claude-code-hooks-multi-agent-observability/
│
├── apps/                    # Application components
│   ├── server/             # Bun TypeScript server
│   │   ├── src/
│   │   │   ├── index.ts    # Main server with HTTP/WebSocket endpoints
│   │   │   ├── db.ts       # SQLite database management & migrations
│   │   │   └── types.ts    # TypeScript interfaces
│   │   ├── package.json
│   │   └── events.db       # SQLite database (gitignored)
│   │
│   └── client/             # Vue 3 TypeScript client
│       ├── src/
│       │   ├── App.vue     # Main app with theme & WebSocket management
│       │   ├── components/
│       │   │   ├── EventTimeline.vue      # Event list with auto-scroll
│       │   │   ├── EventRow.vue           # Individual event display
│       │   │   ├── FilterPanel.vue        # Multi-select filters
│       │   │   ├── ChatTranscriptModal.vue # Chat history viewer
│       │   │   ├── StickScrollButton.vue  # Scroll control
│       │   │   └── LivePulseChart.vue     # Real-time activity chart
│       │   ├── composables/
│       │   │   ├── useWebSocket.ts        # WebSocket connection logic
│       │   │   ├── useEventColors.ts      # Color assignment system
│       │   │   ├── useChartData.ts        # Chart data aggregation
│       │   │   └── useEventEmojis.ts      # Event type emoji mapping
│       │   ├── utils/
│       │   │   └── chartRenderer.ts       # Canvas chart rendering
│       │   └── types.ts    # TypeScript interfaces
│       ├── .env.sample     # Environment configuration template
│       └── package.json
│
├── .claude/                # Claude Code integration
│   ├── hooks/             # Hook scripts (Python with uv)
│   │   ├── send_event.py  # Universal event sender
│   │   ├── pre_tool_use.py    # Tool validation & blocking
│   │   ├── post_tool_use.py   # Result logging
│   │   ├── notification.py    # User interaction events
│   │   ├── user_prompt_submit.py # User prompt logging & validation
│   │   ├── stop.py           # Session completion
│   │   └── subagent_stop.py  # Subagent completion
│   │
│   └── settings.json      # Hook configuration
│
├── scripts/               # Utility scripts
│   ├── start-system.sh   # Launch server & client
│   ├── reset-system.sh   # Stop all processes
│   └── test-system.sh    # System validation
│
└── logs/                 # Application logs (gitignored)
```

## 🔧 Component Details

### 1. Hook System (`.claude/hooks/`)

> If you want to master claude code hooks watch [this video](https://github.com/disler/claude-code-hooks-mastery)

The hook system intercepts Claude Code lifecycle events:

- **`send_event.py`**: Core script that sends event data to the observability server
  - Supports `--add-chat` flag for including conversation history
  - Validates server connectivity before sending
  - Handles all event types with proper error handling

- **Event-specific hooks**: Each implements validation and data extraction
  - `pre_tool_use.py`: Blocks dangerous commands, validates tool usage
  - `post_tool_use.py`: Captures execution results and outputs
  - `notification.py`: Tracks user interaction points
  - `user_prompt_submit.py`: Logs user prompts, supports validation (v1.0.54+)
  - `stop.py`: Records session completion with optional chat history
  - `subagent_stop.py`: Monitors subagent task completion
  - `pre_compact.py`: Tracks context compaction operations (manual/auto)
  - `session_start.py`: Logs session start, can load development context
  - `session_end.py`: Logs session end, saves session statistics

> **⚡ Performance Tip**: For 17x faster hooks (6ms vs 101ms), see the optional [compiled Go hooks](./.claude/hooks/claude-hook/). Recommended for production use with high tool frequency.

### 2. Server (`apps/server/`)

Bun-powered TypeScript server with real-time capabilities:

- **Database**: SQLite with WAL mode for concurrent access
- **Endpoints**:
  - `POST /events` - Receive events from agents
  - `GET /events/recent` - Paginated event retrieval with filtering
  - `GET /events/filter-options` - Available filter values
  - `GET /health` - Health check with server status, database metrics, and WebSocket client count
  - `WS /stream` - Real-time event broadcasting
- **Features**:
  - Automatic schema migrations
  - Event validation
  - WebSocket broadcast to all clients
  - Chat transcript storage
  - System health monitoring

#### Health Check Endpoint

The `/health` endpoint provides comprehensive system status:

```bash
# Check server health
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

Response example:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T12:29:25.527Z",
  "server": {
    "uptime_ms": 13866,
    "version": "1.0.0",
    "port": 4000
  },
  "database": {
    "size_bytes": 777912320,
    "size_mb": "741.88",
    "total_events": 9292,
    "active_sessions_24h": 49,
    "events_last_minute": 73
  },
  "websocket": {
    "connected_clients": 3
  }
}
```

### 3. Client (`apps/client/`)

Vue 3 application with real-time visualization:

- **Visual Design**:
  - Dual-color system: App colors (left border) + Session colors (second border)
  - Gradient indicators for visual distinction
  - Dark/light theme support
  - Responsive layout with smooth animations

- **Features**:
  - Real-time WebSocket updates
  - Multi-criteria filtering (app, session, event type)
  - Live pulse chart with session-colored bars and event type indicators
  - Time range selection (1m, 3m, 5m) with appropriate data aggregation
  - Chat transcript viewer with syntax highlighting
  - Auto-scroll with manual override
  - Event limiting (configurable via `VITE_MAX_EVENTS_TO_DISPLAY`)

- **Live Pulse Chart**:
  - Canvas-based real-time visualization
  - Session-specific colors for each bar
  - Event type emojis displayed on bars
  - Smooth animations and glow effects
  - Responsive to filter changes

## 🔄 Data Flow

1. **Event Generation**: Claude Code executes an action (tool use, notification, etc.)
2. **Hook Activation**: Corresponding hook script runs based on `settings.json` configuration
3. **Data Collection**: Hook script gathers context (tool name, inputs, outputs, session ID)
4. **Transmission**: `send_event.py` sends JSON payload to server via HTTP POST
5. **Server Processing**:
   - Validates event structure
   - Stores in SQLite with timestamp
   - Broadcasts to WebSocket clients
6. **Client Update**: Vue app receives event and updates timeline in real-time

## 🎨 Event Types & Visualization

| Event Type       | Emoji | Purpose                | Color Coding  | Special Display                       | Agent |
| ---------------- | ----- | ---------------------- | ------------- | ------------------------------------- | ----- |
| PreToolUse       | 🔧     | Before tool execution  | Session-based | Tool name & details                   | Claude |
| PostToolUse      | ✅     | After tool completion  | Session-based | Tool name & results                   | Claude |
| Notification     | 🔔     | User interactions      | Session-based | Notification message                  | Claude |
| Stop             | 🛑     | Response completion    | Session-based | Summary & chat transcript             | Claude |
| SubagentStop     | 👥     | Subagent finished      | Session-based | Subagent details                      | Claude |
| PreCompact       | 📦     | Context compaction     | Session-based | Compaction details                    | Claude |
| UserPromptSubmit | 💬     | User prompt submission | Session-based | Prompt: _"user message"_ (italic)     | Claude |
| SessionStart     | 🚀     | Session started        | Session-based | Session source (startup/resume/clear) | Claude |
| SessionEnd       | 🏁     | Session ended          | Session-based | End reason (clear/logout/exit/other)  | Claude |
| TaskStart        | ▶️     | Codex task begins      | Session-based | Command & model                       | Codex |
| TaskComplete     | ✅     | Codex task success     | Session-based | Duration & exit code                  | Codex |
| TaskError        | ❌     | Codex task failed      | Session-based | Error message & exit code             | Codex |

### UserPromptSubmit Event (v1.0.54+)

The `UserPromptSubmit` hook captures every user prompt before Claude processes it. In the UI:
- Displays as `Prompt: "user's message"` in italic text
- Shows the actual prompt content inline (truncated to 100 chars)
- Summary appears on the right side when AI summarization is enabled
- Useful for tracking user intentions and conversation flow

## 🤖 Multi-Agent Support: Codex CLI Integration

The observability system now supports tracking **multiple AI agents** beyond Claude, starting with **OpenAI Codex CLI** integration.

### Supported Agents

| Agent | Type | Version Tracking | Status |
|-------|------|------------------|--------|
| **Claude Code** | `claude` | ✅ (via model_name) | Default |
| **OpenAI Codex** | `codex` | ✅ (via agent_version) | ✅ Supported |
| **Google Gemini** | `gemini` | ✅ | 🚧 Planned |
| **Custom** | `custom` | ✅ | 🚧 Extensible |

### Codex CLI Tracking

Track [OpenAI Codex CLI](https://github.com/openai/openai-codex-cli) executions with full observability:

#### Installation

1. **Install Codex CLI** (if not already installed):
   ```bash
   npm install -g @openai/codex-cli

   # Set your OpenAI API key
   export OPENAI_API_KEY="sk-..."
   ```

2. **One-Command Global Installation** (Recommended):

   The easiest way to enable cross-repo Codex tracking:

   ```bash
   # Run the automated installer
   ./scripts/install-global-tracking.sh
   ```

   This script will:
   - ✅ Copy all necessary files to `~/.local/bin/codex-observability/`
   - ✅ Create symlink at `~/.local/bin/codex-tracked`
   - ✅ Add `~/.local/bin` to your PATH (if needed)
   - ✅ Optionally create `codex` alias for automatic tracking
   - ✅ Validate the installation

   After installation:
   ```bash
   # Reload your shell
   source ~/.zshrc  # or ~/.bashrc

   # Test it works
   codex-tracked --help
   ```

3. **Manual Installation** (Alternative):

   If you prefer to install manually:

   ```bash
   # Install wrapper globally
   mkdir -p ~/.local/bin/codex-observability
   cp .claude/hooks/codex-tracked ~/.local/bin/codex-observability/
   cp .claude/hooks/codex_wrapper.ts ~/.local/bin/codex-observability/
   cp .claude/hooks/send_event.py ~/.local/bin/codex-observability/
   cp -r .claude/hooks/utils ~/.local/bin/codex-observability/
   chmod +x ~/.local/bin/codex-observability/codex-tracked

   # Create convenient symlink
   ln -sf ~/.local/bin/codex-observability/codex-tracked ~/.local/bin/codex-tracked

   # Add to shell (if not already in PATH)
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc

   # Optional: Create alias for automatic tracking
   echo 'alias codex="codex-tracked"' >> ~/.zshrc
   source ~/.zshrc
   ```

Now every `codex` command from any directory will automatically track to the dashboard!

#### Usage

**Local (per-repo)**:
```bash
# From this repository
./.claude/hooks/codex-tracked exec -m gpt-5.1-codex-max "Refactor this codebase"
```

**Global (from any repository)**:
```bash
# If you installed globally
codex-tracked exec -m gpt-5.1-codex-max "Your task"

# Or with alias (automatically tracked)
codex exec -m gpt-5.1-codex-max "Your task"
```

The wrapper works from **any directory** if installed globally!

**What gets tracked:**
- ✅ **TaskStart** - Codex session begins (▶️)
- ✅ **TaskComplete** - Successful completion (✅)
- ✅ **TaskError** - Execution errors (❌)
- ✅ **Agent metadata**: Model name, version (0.64.0), command, duration
- ✅ **Session tracking**: UUID-based session IDs

#### Wrapper Architecture

```
User Command → codex-tracked → Codex CLI → send_event.py → Dashboard
                    ↓
              Session UUID
              Event Timing
              Error Handling
```

The `codex-tracked` wrapper:
1. Generates a unique session ID
2. Emits **TaskStart** event before Codex executes
3. Spawns actual Codex CLI process
4. Captures exit code and duration
5. Emits **TaskComplete** or **TaskError** based on result
6. Preserves original Codex output and exit codes

#### Dashboard Visualization

Events from Codex appear in the dashboard with:
- **Purple 🤖 badge**: Shows agent type (e.g., "codex")
- **Tooltip**: Displays agent version on hover
- **Distinct icons**: ▶️ TaskStart, ✅ TaskComplete, ❌ TaskError
- **Filtering**: Filter events by `agent_type` in the dashboard

#### Event Filtering

Filter events by agent type via UI or API:

```bash
# Via API - Get only Codex events
curl 'http://localhost:4000/events/recent?agent_type=codex&limit=50'

# Via API - Get only Claude events
curl 'http://localhost:4000/events/recent?agent_type=claude&limit=50'
```

In the dashboard:
1. Click the **Agent Type** dropdown in the filter panel
2. Select "codex" to see only Codex events
3. Select "claude" to see only Claude events
4. Select "All Agents" to see everything

### Event Queue & Offline Resilience

If the observability server is unavailable:
- ✅ Events are **queued locally** at `.claude/data/event_queue.jsonl`
- ✅ **Automatic retry** with exponential backoff (0.5s, 1s, 2s)
- ✅ **Queue flush** when server reconnects
- ✅ **No blocking** - Codex execution continues regardless

### Example: Mixed Agent Workflow

Track both Claude and Codex working together:

```bash
# 1. Claude explores the codebase
claude "Analyze the authentication module and identify refactoring opportunities"

# 2. Codex implements the refactoring
./.claude/hooks/codex-tracked exec -m gpt-5.1-codex-max \
  "Refactor the authentication module based on the analysis in the previous session"

# 3. Claude reviews the changes
claude "Review the refactoring changes and run tests"
```

All events appear in the same dashboard with clear agent identification.

### Adding Custom Agents

To add support for other AI agents:

1. **Create a wrapper script** (similar to `codex-tracked`)
2. **Emit events** using `send_event.py`:
   ```bash
   echo '{"session_id": "...", ...}' | \
     python3 .claude/hooks/send_event.py \
       --source-app "your-agent-cli" \
       --event-type "TaskStart" \
       --agent-type "custom" \
       --agent-version "1.0.0"
   ```
3. **Define event types** and emojis in `apps/client/src/composables/useEventEmojis.ts`

See `.claude/hooks/codex_wrapper.ts` for a complete reference implementation.


## 🔌 Integration

### For New Projects

1. Copy the event sender:
   ```bash
   cp .claude/hooks/send_event.py YOUR_PROJECT/.claude/hooks/
   ```

2. Add to your `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "PreToolUse": [{
         "matcher": ".*",
         "hooks": [{
           "type": "command",
           "command": "uv run .claude/hooks/send_event.py --source-app YOUR_APP --event-type PreToolUse"
         }]
       }]
     }
   }
   ```

### For This Project

Already integrated! Hooks run both validation and observability:
```json
{
  "type": "command",
  "command": "uv run .claude/hooks/pre_tool_use.py"
},
{
  "type": "command", 
  "command": "uv run .claude/hooks/send_event.py --source-app cc-hooks-observability --event-type PreToolUse"
}
```

## 🧪 Testing

```bash
# System validation
./scripts/test-system.sh

# Manual event test
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "test",
    "session_id": "test-123",
    "hook_event_type": "PreToolUse",
    "payload": {"tool_name": "Bash", "tool_input": {"command": "ls"}}
  }'
```

## ⚙️ Configuration

### Environment Variables

Copy `.env.sample` to `.env` in the project root and fill in your API keys:

**Application Root** (`.env` file):
- `ANTHROPIC_API_KEY` – Anthropic Claude API key (required)
- `ENGINEER_NAME` – Your name (for logging/identification)
- `GEMINI_API_KEY` – Google Gemini API key (optional)
- `OPENAI_API_KEY` – OpenAI API key (optional)
- `ELEVEN_API_KEY` – ElevenLabs API key (optional)

**Client** (`.env` file in `apps/client/.env`):
- `VITE_MAX_EVENTS_TO_DISPLAY=100` – Maximum events to show (removes oldest when exceeded)

### Server Ports

- Server: `4000` (HTTP/WebSocket)
- Client: `5173` (Vite dev server)

## 🛡️ Security Features

- Blocks dangerous commands (`rm -rf`, etc.)
- Prevents access to sensitive files (`.env`, private keys)
- Validates all inputs before execution
- No external dependencies for core functionality

## 📊 Technical Stack

- **Server**: Bun, TypeScript, SQLite
- **Client**: Vue 3, TypeScript, Vite, Tailwind CSS
- **Hooks**: Python 3.8+, Astral uv, TTS (ElevenLabs or OpenAI), LLMs (Claude or OpenAI)
- **Communication**: HTTP REST, WebSocket

## 🔧 Troubleshooting

### Hook Scripts Not Working

If your hook scripts aren't executing properly, it might be due to relative paths in your `.claude/settings.json`. Claude Code documentation recommends using absolute paths for command scripts.

**Solution**: Use the custom Claude Code slash command to automatically convert all relative paths to absolute paths:

```bash
# In Claude Code, simply run:
/convert_paths_absolute
```

This command will:
- Find all relative paths in your hook command scripts
- Convert them to absolute paths based on your current working directory
- Create a backup of your original settings.json
- Show you exactly what changes were made

This ensures your hooks work correctly regardless of where Claude Code is executed from.

## Master AI **Agentic Coding**
> And prepare for the future of software engineering

Learn tactical agentic coding patterns with [Tactical Agentic Coding](https://agenticengineer.com/tactical-agentic-coding?y=cchobvwh45)

Follow the [IndyDevDan YouTube channel](https://www.youtube.com/@indydevdan) to improve your agentic coding advantage.


### Codex Integration Issues

**Problem**: Codex wrapper not found or permission denied

```bash
# Solution: Make wrapper executable
chmod +x .claude/hooks/codex-tracked

# Verify it's executable
ls -la .claude/hooks/codex-tracked
```

**Problem**: Codex events not appearing in dashboard

```bash
# Check if observability server is running
curl http://localhost:4000/events/filter-options

# Check event queue for offline events
cat .claude/data/event_queue.jsonl

# Verify Codex CLI is installed
codex --version
```

**Problem**: "codex: command not found"

```bash
# Install Codex CLI globally
npm install -g @openai/codex-cli

# Set OpenAI API key
export OPENAI_API_KEY="sk-..."

# Verify installation
codex --version
```

**Problem**: Events show wrong agent_type

The wrapper automatically sets `agent_type: "codex"`. If you see incorrect types:
1. Make sure you're using `./.claude/hooks/codex-tracked` (not plain `codex`)
2. Check that `send_event.py` has the `--agent-type codex` argument
3. Verify the wrapper script hasn't been modified

**Problem**: Agent filter shows no Codex events

Codex events may be older than recent Claude events. Increase the limit:

```bash
# API: Use larger limit
curl 'http://localhost:4000/events/recent?agent_type=codex&limit=100'

# Dashboard: The filter automatically fetches enough events
```

