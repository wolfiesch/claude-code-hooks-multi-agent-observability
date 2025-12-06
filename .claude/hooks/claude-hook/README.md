# Claude Hook - Compiled Observability Hook

**50-100x faster** than Python implementation for Claude Code observability hooks.

## Performance

| Implementation | Startup Time | Speedup |
|----------------|--------------|---------|
| Python (`send_event.py`) | ~100-150ms | 1x |
| Go (`claude-hook`) | **~1-2ms** | **50-100x** |

**Impact**: On a 50-tool session, saves 5-7.5 seconds of cumulative latency.

## Features

- ✅ **Complete feature parity** with `send_event.py`
- ✅ **Native LLM summarization**: Multi-provider support (OpenAI/Anthropic)
- ✅ **Tier 0 metadata**: Git context, session context, environment context
- ✅ **Tier 1 metadata**: Tool performance, session stats
- ✅ **Event queueing**: Offline support with auto-retry
- ✅ **Backward compatible**: Drop-in replacement
- ⚡ **Sub-millisecond startup**: No Python interpreter overhead
- 📦 **Single binary**: No dependencies, ~5.6MB binary

## Quick Start

### Build

```bash
make build
```

### Install

```bash
make install

# Add to PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$HOME/.claude/bin:$PATH"
```

### Test

```bash
# Test basic functionality
echo '{"session_id":"test"}' | ./claude-hook \
  --source-app test \
  --event-type PostToolUse \
  --server-url http://localhost:4000/events

# Benchmark vs Python
make compare
```

## Integration with Claude Code

### Option 1: Direct Replacement (Recommended)

Update `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/bin/claude-hook --source-app claude-global --event-type PostToolUse"
      }]
    }],
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/bin/claude-hook --source-app claude-global --event-type PreToolUse"
      }]
    }]
  }
}
```

### Option 2: Wrapper Script (Gradual Migration)

Create `~/.claude/hooks/observability-hook.sh`:

```bash
#!/bin/bash
# Use compiled hook if available, fall back to Python
if command -v claude-hook &> /dev/null; then
    claude-hook "$@"
else
    uv run /path/to/send_event.py "$@"
fi
```

## CLI Reference

```bash
claude-hook [options]

Options:
  --source-app string      Source application name (required)
  --event-type string      Hook event type: PreToolUse, PostToolUse, etc. (required)
  --server-url string      Server URL (default: http://localhost:4000/events)
  --agent-type string      Agent type: claude, codex, gemini (default: claude)
  --agent-version string   Agent CLI version (optional)
  --add-chat              Include chat transcript
  --summarize             Generate AI summary using OpenAI/Anthropic
```

## LLM Summarization

The `--summarize` flag enables AI-generated summaries of hook events using **native Go implementation** with multi-provider support. No Python dependencies required.

### Provider Priority

The binary automatically selects the best available provider:

1. **OpenAI** (Primary) - Set `OPENAI_API_KEY`
   - Model: `gpt-5-nano`
   - Cost: ~$0.00005 per event (0.005¢)
   - Fastest, most cost-effective
   - **15x cheaper than Anthropic**

2. **Anthropic** (Secondary) - Set `ANTHROPIC_API_KEY`
   - Model: `claude-haiku-4-5-20251001`
   - Cost: ~$0.0008 per event (0.08¢)
   - Used when OpenAI key not available

3. **None** - No API key set
   - Summarization silently skipped
   - Events still sent without summary
   - Graceful degradation

### Configuration

```bash
# Use OpenAI (recommended)
export OPENAI_API_KEY="sk-..."

# Or use Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Use in hooks
claude-hook --source-app claude-global --event-type PostToolUse --summarize
```

### Performance & Cost

| Metric | Value |
|--------|-------|
| Timeout | 2 seconds (hard limit) |
| Typical latency | 100-300ms |
| Per-event cost (OpenAI) | $0.00005 (0.005¢) |
| Per-session cost (76 tools) | $0.0040 (0.4¢) |
| Per 200 sessions/month | $0.79 |
| Per 300 sessions/month | $1.18 |

**Cost is negligible** - even heavy users (300+ sessions/month) spend ~$1/month.

### Example Output

```json
{
  "summary": "Reads configuration file from project root",
  "summaryProvider": "openai"
}
```

Summaries are:
- One sentence, <15 words
- Technical and specific
- Present tense, no formatting
- Included in event payload

## What's Included

**Compiled in Go:**
- ✅ HTTP POST with retry/backoff
- ✅ Event queueing for offline support
- ✅ Git metadata collection
- ✅ Session tracking
- ✅ Environment detection
- ✅ Model extraction from transcript
- ✅ Chat transcript inclusion
- ✅ **Native LLM summarization** (OpenAI/Anthropic)
- ✅ Multi-provider fallback with graceful degradation

**No Python Dependencies:**
- ❌ Python interpreter not required
- ❌ No `uv`, `pip`, or virtual environments
- ✅ Pure Go stdlib implementation

## Architecture

```
┌─────────────────────────────────────────┐
│   Claude Code Hook Event (stdin)       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
       ┌───────────────────────┐
       │   claude-hook (Go)    │
       │   Startup: ~1ms       │
       └───────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌─────────────┐        ┌──────────────┐
│  Metadata   │        │ HTTP POST    │
│  Collection │        │ to Server    │
│  (Tier 0/1) │        │ w/ Retry     │
└─────────────┘        └──────┬───────┘
                              │
                     ┌────────┴────────┐
                     │                 │
                     ▼                 ▼
              ┌───────────┐     ┌──────────┐
              │  Success  │     │  Failed  │
              │  (200 OK) │     │  (Queue) │
              └───────────┘     └──────────┘
```

## Development

### Build

```bash
make build          # Development build
make build-release  # Optimized release build
```

### Test

```bash
make test          # Run Go tests
make compare       # Compare with Python version
make benchmark     # Measure startup time
```

### Clean

```bash
make clean
```

## Migration Guide

### Phase 1: PostToolUse/PreToolUse (Highest Impact)

These hooks fire on **every tool use** - biggest performance gain.

**Before:**
```bash
# 100ms per tool use
uv run /path/to/send_event.py --source-app claude-global --event-type PostToolUse
```

**After:**
```bash
# 1ms per tool use (100x faster)
claude-hook --source-app claude-global --event-type PostToolUse
```

### Phase 2: SessionStart/SessionEnd

Lower frequency, but clean migration.

### Phase 3: Optional - Notification

Depends on whether you need AI summaries.

## Troubleshooting

### "command not found: claude-hook"

```bash
# Ensure installed
make install

# Add to PATH
export PATH="$HOME/.claude/bin:$PATH"

# Verify
which claude-hook
```

### Events not reaching server

```bash
# Check queue file
cat "$CLAUDE_PROJECT_DIR/.claude/data/event_queue.jsonl"

# Test server connectivity
curl -X POST http://localhost:4000/events -d '{"test":true}'
```

### Need AI summarization?

```bash
# Set API key and use --summarize flag
export OPENAI_API_KEY="sk-..."
claude-hook --source-app claude-global --event-type PostToolUse --summarize

# Or use Anthropic as fallback
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Performance Benchmarks

Measured on M1 MacBook Pro:

```
$ make compare

=== Python (send_event.py) ===
real         0.12
user         0.09
sys          0.02

=== Go (claude-hook) ===
real         0.00
user         0.00
sys          0.00

Speedup: ~100x
```

**Real-world impact (50-tool session):**
- Python: 50 × 100ms = 5,000ms = **5 seconds**
- Go: 50 × 1ms = 50ms = **0.05 seconds**
- **Savings: 4.95 seconds per session**

## Technical Details

**Language**: Go 1.21+
**Dependencies**: None (stdlib only)
**Binary size**: ~5.6MB (statically linked, includes LLM clients)
**Platforms**: macOS (darwin/amd64, darwin/arm64), Linux (linux/amd64, linux/arm64)

**Why Go?**
- Sub-millisecond startup
- Single binary deployment
- Excellent stdlib (HTTP, JSON, exec)
- Easy maintenance

**What about Rust?**
- Similar performance to Go
- More complex to maintain
- Overkill for this use case

## License

Same as parent project.

## Contributing

1. Make changes to `main.go`
2. Test with `make test && make compare`
3. Update README if needed
4. Submit PR

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Maintained**: Yes
