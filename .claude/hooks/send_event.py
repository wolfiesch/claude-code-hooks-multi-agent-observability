#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "anthropic",
#     "python-dotenv",
# ]
# ///

"""
Multi-Agent Observability Hook Script
Sends Claude Code hook events to the observability server.

Enhanced with Tier 0 metadata collection:
- Git context (branch, commit, dirty status, remote tracking)
- Session context (start time, duration, model, working directory)
- Environment context (OS, shell, Python/Node versions)
"""

import json
import sys
import os
import argparse
import urllib.request
import urllib.error
from datetime import datetime

# Add shared utilities to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'shared'))

from utils.summarizer import generate_event_summary
from utils.model_extractor import get_model_from_transcript
from utils.constants import ensure_session_log_dir

try:
    from metadata_collector import MetadataCollector
    METADATA_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import MetadataCollector: {e}", file=sys.stderr)
    METADATA_AVAILABLE = False

try:
    from tool_metadata_parser import ToolMetadataParser
    PARSER_AVAILABLE = True
except ImportError:
    PARSER_AVAILABLE = False

def get_queue_file():
    """Get the path to the event queue file."""
    from pathlib import Path
    # Use project-local queue in .claude/data/
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
    queue_dir = Path(project_dir) / '.claude' / 'data'
    queue_dir.mkdir(parents=True, exist_ok=True)
    return queue_dir / 'event_queue.jsonl'

def queue_event(event_data):
    """Queue event for later delivery if server unavailable."""
    try:
        queue_file = get_queue_file()
        with open(queue_file, 'a') as f:
            f.write(json.dumps(event_data) + '\n')
        return True
    except Exception as e:
        print(f"Failed to queue event: {e}", file=sys.stderr)
        return False

def flush_queue(server_url='http://localhost:4000/events'):
    """Attempt to send queued events."""
    queue_file = get_queue_file()
    if not queue_file.exists():
        return

    try:
        # Read queued events
        with open(queue_file, 'r') as f:
            queued_events = [json.loads(line.strip()) for line in f if line.strip()]

        if not queued_events:
            return

        # Try to send each queued event
        successful = []
        for i, event in enumerate(queued_events):
            if send_event_to_server(event, server_url, retry=False):
                successful.append(i)

        # Remove successfully sent events from queue
        if successful:
            remaining = [e for i, e in enumerate(queued_events) if i not in successful]
            with open(queue_file, 'w') as f:
                for event in remaining:
                    f.write(json.dumps(event) + '\n')

            # If queue is now empty, delete the file
            if not remaining:
                queue_file.unlink()

    except Exception as e:
        print(f"Failed to flush queue: {e}", file=sys.stderr)

def send_event_to_server(event_data, server_url='http://localhost:4000/events', retry=True, max_retries=3):
    """Send event data to the observability server with retry logic."""
    import time

    for attempt in range(max_retries if retry else 1):
        try:
            # Prepare the request
            req = urllib.request.Request(
                server_url,
                data=json.dumps(event_data).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Claude-Code-Hook/1.0'
                }
            )

            # Send the request
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    # Success! Try to flush any queued events
                    if retry:
                        flush_queue(server_url)
                    return True
                else:
                    print(f"Server returned status: {response.status}", file=sys.stderr)

        except urllib.error.URLError as e:
            if attempt < max_retries - 1 and retry:
                # Exponential backoff: 0.5s, 1s, 2s
                wait_time = 0.5 * (2 ** attempt)
                time.sleep(wait_time)
                continue
            else:
                print(f"Failed to send event after {attempt + 1} attempts: {e}", file=sys.stderr)

        except Exception as e:
            print(f"Unexpected error: {e}", file=sys.stderr)
            break

    # All retries failed - queue the event for later
    if retry:
        queue_event(event_data)

    return False

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Send Claude Code hook events to observability server')
    parser.add_argument('--source-app', required=True, help='Source application name')
    parser.add_argument('--event-type', required=True, help='Hook event type (PreToolUse, PostToolUse, etc.)')
    parser.add_argument('--server-url', default='http://localhost:4000/events', help='Server URL')
    parser.add_argument('--add-chat', action='store_true', help='Include chat transcript if available')
    parser.add_argument('--summarize', action='store_true', help='Generate AI summary of the event')

    # Multi-agent support arguments
    parser.add_argument('--agent-type',
        type=str,
        default='claude',
        choices=['claude', 'codex', 'gemini', 'custom'],
        help='Type of AI agent generating this event (default: claude)')

    parser.add_argument('--agent-version',
        type=str,
        default=None,
        help='Agent CLI version (e.g., "0.64.0" for Codex)')

    args = parser.parse_args()
    
    try:
        # Read hook data from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Extract model name from transcript (with caching)
    session_id = input_data.get('session_id', 'unknown')
    transcript_path = input_data.get('transcript_path', '')
    model_name = ''
    if transcript_path:
        model_name = get_model_from_transcript(session_id, transcript_path)

    # Get project directory from environment
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())

    # Collect Tier 0, Tier 1, and Tier 2 metadata
    tier0_metadata = {}
    tier1_metadata = {}
    tier2_metadata = {}

    if METADATA_AVAILABLE:
        try:
            collector = MetadataCollector(project_dir)
            tier0_metadata = collector.collect_tier0_metadata(session_id, model_name)

            # Increment tool count for PostToolUse events
            if args.event_type == 'PostToolUse':
                collector.increment_tool_count(session_id)

            # Tier 1: Collect tool performance metadata
            tool_name = input_data.get('tool_name', '')
            tool_input = input_data.get('tool_input', {})
            duration_ms = None

            # For PostToolUse, try to read duration from temp file
            if args.event_type == 'PostToolUse':
                try:
                    log_dir = ensure_session_log_dir(session_id)
                    duration_file = log_dir / 'last_tool_duration.json'
                    if duration_file.exists():
                        with open(duration_file, 'r') as f:
                            duration_data = json.load(f)
                            if duration_data.get('tool_name') == tool_name:
                                duration_ms = duration_data.get('duration_ms')
                        # Clean up duration file after reading
                        duration_file.unlink()
                except Exception:
                    pass

            # Collect Tier 1 metadata (tool performance + session stats)
            tier1_metadata = collector.collect_tier1_metadata(
                session_id,
                tool_name if tool_name else None,
                tool_input if tool_input else None,
                duration_ms
            )

            # Tier 2: Collect workflow intelligence metadata
            tier2_metadata = collector.collect_tier2_metadata(
                session_id,
                tool_name if tool_name else None,
                tool_input if tool_input else None
            )

            # Cleanup old sessions periodically (every 100 events)
            import random
            if random.randint(1, 100) == 1:
                collector.cleanup_old_sessions()
        except Exception as e:
            print(f"Warning: Failed to collect metadata: {e}", file=sys.stderr)

    # Prepare event data for server
    event_data = {
        'source_app': args.source_app,
        'session_id': session_id,
        'hook_event_type': args.event_type,
        'payload': input_data,
        'timestamp': int(datetime.now().timestamp() * 1000),
        'model_name': model_name,
        # ✨ Multi-agent support
        'agent_type': args.agent_type,
        # ✨ Add Tier 0 metadata (git, session, environment)
        **tier0_metadata,
        # ✨ Add Tier 1 metadata (tool performance + session stats)
        **tier1_metadata
    }

    # Add agent_version if provided
    if args.agent_version:
        event_data['agent_version'] = args.agent_version

    # ✨ Add Tier 2 metadata (workflow intelligence) as nested object
    if tier2_metadata:
        event_data['workflow'] = tier2_metadata
    
    # Handle --add-chat option
    if args.add_chat and 'transcript_path' in input_data:
        transcript_path = input_data['transcript_path']
        if os.path.exists(transcript_path):
            # Read .jsonl file and convert to JSON array
            chat_data = []
            try:
                with open(transcript_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                chat_data.append(json.loads(line))
                            except json.JSONDecodeError:
                                pass  # Skip invalid lines
                
                # Add chat to event data
                event_data['chat'] = chat_data
            except Exception as e:
                print(f"Failed to read transcript: {e}", file=sys.stderr)
    
    # Generate summary if requested
    if args.summarize:
        summary = generate_event_summary(event_data)
        if summary:
            event_data['summary'] = summary
        # Continue even if summary generation fails
    
    # Send to server
    success = send_event_to_server(event_data, args.server_url)
    
    # Always exit with 0 to not block Claude Code operations
    sys.exit(0)

if __name__ == '__main__':
    main()