#!/bin/bash
# Setup Global Claude Code Hooks for Multi-Agent Observability
# This script configures hooks globally so they work automatically for ALL projects

set -e

echo "🚀 Setting up global Claude Code hooks for Multi-Agent Observability..."

# Create global hooks directory
mkdir -p ~/.claude/hooks/shared
mkdir -p ~/.claude/hooks/utils

# Copy hook scripts
echo "📂 Copying hook scripts to ~/.claude/hooks/..."
cp .claude/hooks/*.py ~/.claude/hooks/
cp -r .claude/hooks/shared/*.py ~/.claude/hooks/shared/ 2>/dev/null || true
cp -r .claude/hooks/utils ~/.claude/hooks/ 2>/dev/null || true

# Make scripts executable
chmod +x ~/.claude/hooks/*.py

echo "✅ Hooks copied successfully!"

# Backup existing global settings
if [ -f ~/.claude/settings.json ]; then
    BACKUP_FILE=~/.claude/settings.json.backup-$(date +%Y%m%d-%H%M%S)
    cp ~/.claude/settings.json "$BACKUP_FILE"
    echo "💾 Backed up existing settings to $BACKUP_FILE"
fi

# Create hooks configuration
echo "⚙️  Configuring global settings.json..."

# Read existing permissions if they exist
PERMISSIONS='{}'
if [ -f ~/.claude/settings.json ]; then
    PERMISSIONS=$(cat ~/.claude/settings.json | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data.get('permissions', {})))" 2>/dev/null || echo '{}')
fi

# Create complete settings with hooks
cat > ~/.claude/settings.json << EOF
{
  "permissions": $PERMISSIONS,
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/pre_tool_use.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type PreToolUse --summarize"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/post_tool_use.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type PostToolUse --summarize"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/notification.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type Notification --summarize"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/stop.py --chat"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type Stop --add-chat"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/subagent_stop.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type SubagentStop"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/pre_compact.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type PreCompact"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/user_prompt_submit.py --log-only --store-last-prompt --name-agent"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type UserPromptSubmit --summarize"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/session_start.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type SessionStart"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/session_end.py"
          },
          {
            "type": "command",
            "command": "uv run ~/.claude/hooks/send_event.py --event-type SessionEnd"
          }
        ]
      }
    ]
  }
}
EOF

echo "✅ Global settings configured!"
echo ""
echo "🎉 Setup complete! Your Claude Code hooks are now global."
echo ""
echo "ℹ️  How it works:"
echo "  • Hooks automatically detect project name from directory"
echo "  • No need to copy .claude/ to new projects"
echo "  • All projects automatically report to your observability dashboard"
echo ""
echo "📊 Dashboard: http://localhost:5173"
echo "🔧 Server: Make sure to run 'cd apps/server && bun run dev'"
echo ""
echo "💡 Pro tip: You can still override with --source-app if needed"
echo ""
echo "🧪 Test it: cd to any project directory and run 'claude'"
