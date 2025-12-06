#!/bin/bash
set -e

BACKUP_FILE="$HOME/.claude/bin/claude-hook.backup.$(date +%Y%m%d_%H%M%S)"
TARGET="$HOME/.claude/bin/claude-hook"

echo "Backing up existing binary to: $BACKUP_FILE"
cp "$TARGET" "$BACKUP_FILE" 2>/dev/null || true

echo "Deploying new binary to: $TARGET"
cp claude-hook "$TARGET"
chmod +x "$TARGET"

echo "Deployment complete!"
echo "Provider priority: OpenAI > Anthropic"
echo "Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable"
