#!/bin/bash
#
# Setup Global Cross-Repo Observability Hooks
#
# This script configures Claude Code global hooks (~/.claude/settings.json) to track
# agents across ALL repositories on this machine, including sub-agents.
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get absolute path to this project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
HOOKS_DIR="$PROJECT_DIR/.claude/hooks"
GLOBAL_SETTINGS="$HOME/.claude/settings.json"

echo "============================================"
echo "Global Cross-Repo Observability Hook Setup"
echo "============================================"
echo ""

# Verify hooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
  echo -e "${RED}Error: Hooks directory not found at $HOOKS_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Project directory: $PROJECT_DIR"
echo -e "${GREEN}✓${NC} Hooks directory: $HOOKS_DIR"
echo ""

# Check if global settings file exists
if [ -f "$GLOBAL_SETTINGS" ]; then
  echo -e "${YELLOW}⚠${NC}  Existing global settings found at $GLOBAL_SETTINGS"

  # Create backup
  BACKUP_FILE="$GLOBAL_SETTINGS.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$GLOBAL_SETTINGS" "$BACKUP_FILE"
  echo -e "${GREEN}✓${NC} Backup created: $BACKUP_FILE"
  echo ""

  # Check if hooks already exist
  if grep -q "claude-code-hooks-multi-agent-observability" "$GLOBAL_SETTINGS" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC}  Observability hooks already configured in global settings"
    echo ""
    read -p "Do you want to update them? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Setup cancelled."
      exit 0
    fi
  fi
else
  echo -e "${YELLOW}⚠${NC}  No existing global settings file found"
  echo "   Creating new ~/.claude/settings.json"
  mkdir -p "$HOME/.claude"
fi

# Create hooks configuration template
create_hooks_config() {
  cat <<EOF
{
  "hooks": {
    "SessionStart": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type SessionStart"
      }]
    }],
    "SessionEnd": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type SessionEnd"
      }]
    }],
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type PreToolUse --summarize"
      }]
    }],
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type PostToolUse --summarize"
      }]
    }],
    "PreCompact": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type PreCompact"
      }]
    }],
    "Stop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type Stop"
      }]
    }],
    "SubagentStop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type SubagentStop"
      }]
    }],
    "UserPromptSubmit": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type UserPromptSubmit --summarize"
      }]
    }],
    "Notification": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "uv run $HOOKS_DIR/send_event.py --source-app claude-global --event-type Notification"
      }]
    }]
  }
}
EOF
}

# Function to merge hooks with existing settings using Python
merge_settings() {
  python3 - <<PYTHON_SCRIPT
import json
import sys

# Load existing settings
try:
    with open("$GLOBAL_SETTINGS", "r") as f:
        existing = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    existing = {}

# Load new hooks configuration
new_hooks = json.loads('''$(create_hooks_config)''')

# Ensure hooks key exists in existing settings
if "hooks" not in existing:
    existing["hooks"] = {}

# Merge each hook type
for hook_type, hook_config in new_hooks["hooks"].items():
    if hook_type not in existing["hooks"]:
        # Hook type doesn't exist, add it
        existing["hooks"][hook_type] = hook_config
    else:
        # Hook type exists, merge the hooks
        for new_matcher_config in hook_config:
            # Check if this matcher already exists
            existing_matchers = existing["hooks"][hook_type]
            matcher_found = False

            for existing_matcher_config in existing_matchers:
                if existing_matcher_config.get("matcher") == new_matcher_config.get("matcher", ".*"):
                    # Matcher exists, add our hooks to it
                    for new_hook in new_matcher_config["hooks"]:
                        # Only add if not already present
                        if new_hook not in existing_matcher_config["hooks"]:
                            existing_matcher_config["hooks"].append(new_hook)
                    matcher_found = True
                    break

            if not matcher_found:
                # Matcher doesn't exist, add the whole config
                existing["hooks"][hook_type].append(new_matcher_config)

# Write merged settings
with open("$GLOBAL_SETTINGS", "w") as f:
    json.dump(existing, f, indent=2)

print("✓ Global hooks merged successfully")
PYTHON_SCRIPT
}

echo ""
echo "Merging observability hooks into global settings..."
merge_settings

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✓ Global hooks setup complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "What happens now:"
echo "  • All Claude Code sessions on this machine will send events to the observability dashboard"
echo "  • Sub-agents launched in other repos will be tracked automatically"
echo "  • Model information will be captured from any Claude Code session"
echo ""
echo "Next steps:"
echo "  1. Start the observability server:"
echo "     ./scripts/start-system.sh"
echo ""
echo "  2. Open http://localhost:5173 in your browser"
echo ""
echo "  3. Launch Claude Code in ANY repository - events will appear in the dashboard!"
echo ""
echo "Configuration file: $GLOBAL_SETTINGS"
echo "Backup file: $BACKUP_FILE"
echo ""
