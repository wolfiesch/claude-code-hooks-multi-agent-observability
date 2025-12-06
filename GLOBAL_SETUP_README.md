# Global Multi-Agent Observability Setup

## Overview

This setup makes observability hooks work **automatically for ALL your Claude Code projects** without needing to copy `.claude/` directories.

## How It Works

1. **Hooks are installed globally** in `~/.claude/hooks/`
2. **Project names are auto-detected** from the directory name
3. **Works everywhere automatically** - just start coding in any project!

## Installation

Run the setup script once:

```bash
./setup-global-hooks.sh
```

That's it! Now every Claude Code session in any project will automatically:
- Auto-detect the project name from `$CLAUDE_PROJECT_DIR`
- Send events to your observability dashboard
- Show up with the correct repository name

## What Gets Configured

### Global Hooks Location
- **Hooks**: `~/.claude/hooks/*.py`
- **Shared utilities**: `~/.claude/hooks/shared/utils/`
- **Settings**: `~/.claude/settings.json` (backs up existing to `.backup-TIMESTAMP`)

### Auto-Detection Logic

The hooks now automatically detect `source_app` from:
1. `$CLAUDE_PROJECT_DIR` environment variable (Claude Code sets this)
2. Falls back to current working directory name if not set

Examples:
- Working in `/Users/you/Projects/my-cool-app` → shows as **"my-cool-app"**
- Working in `/Users/you/Projects/UFC-pokedex` → shows as **"UFC-pokedex"**
- No more "claude-global"!

## Verification

After setup, start a Claude Code session in any project and check:

```bash
# Open dashboard
open http://localhost:5173

# Check that your project name appears correctly
```

## Manual Override

You can still manually override the project name if needed:

```bash
# In .claude/settings.json of a specific project, add:
"command": "uv run ~/.claude/hooks/send_event.py --source-app custom-name --event-type PreToolUse"
```

## Uninstallation

To remove global hooks:

```bash
# Remove hooks
rm -rf ~/.claude/hooks/

# Restore previous settings (find your backup)
cp ~/.claude/settings.json.backup-YYYYMMDD-HHMMSS ~/.claude/settings.json
```

## Troubleshooting

### "Auto-detected source_app: unknown"
- Claude Code may not be setting `$CLAUDE_PROJECT_DIR`
- Check: `echo $CLAUDE_PROJECT_DIR` in your terminal
- Workaround: Manually add `--source-app your-project-name` to hooks

### Events not showing up
- Make sure the server is running: `cd apps/server && bun run dev`
- Check server logs for connection issues
- Verify hooks are executable: `ls -la ~/.claude/hooks/`

### Want project-specific configuration
- Create `.claude/settings.json` in that project
- Project settings override global settings
- Use `--source-app` flag to customize the name

## Benefits

✅ **Zero configuration** for new projects
✅ **Automatic project detection** from directory names
✅ **No copying** `.claude/` folders everywhere
✅ **Consistent observability** across all projects
✅ **Easy to maintain** - update hooks in one place

## Technical Details

### Modified Hook Script

`send_event.py` now includes:

```python
# Auto-detect source_app from project directory if not provided
if not args.source_app:
    project_dir = os.getenv('CLAUDE_PROJECT_DIR')
    if project_dir:
        args.source_app = os.path.basename(project_dir)
    else:
        args.source_app = os.path.basename(os.getcwd())
    print(f"Auto-detected source_app: {args.source_app}", file=sys.stderr)
```

### Global Settings Structure

```json
{
  "permissions": { ... },  // Preserved from existing settings
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    // All hooks configured to use ~/.claude/hooks/
    // WITHOUT hardcoded --source-app flags
  }
}
```

## Migration from Project-Level Hooks

If you had project-specific hooks before:

1. **Run setup script** - this installs global hooks
2. **Remove project `.claude/` directories** (optional, they'll be ignored)
3. **Keep project settings** if you need custom configurations

Global hooks take precedence unless overridden at project level.

---

**Questions?** Check the main README or open an issue.
