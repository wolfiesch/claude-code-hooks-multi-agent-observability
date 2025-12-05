#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import os
import sys
from pathlib import Path
from utils.constants import ensure_session_log_dir

# Add shared utilities to path for Tier 1 metadata
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'shared'))

try:
    from metadata_collector import MetadataCollector
    TIER1_AVAILABLE = True
except ImportError:
    TIER1_AVAILABLE = False

def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract session_id
        session_id = input_data.get('session_id', 'unknown')
        
        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_path = log_dir / 'post_tool_use.json'
        
        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []
        
        # Append new data
        log_data.append(input_data)

        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        # Tier 1: Record tool end and calculate duration
        if TIER1_AVAILABLE:
            try:
                project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
                tool_name = input_data.get('tool_name', '')

                collector = MetadataCollector(project_dir)
                duration_ms = collector.record_tool_end(session_id, tool_name)

                # Store duration in a temp file for send_event to pick up
                if duration_ms is not None:
                    duration_file = log_dir / 'last_tool_duration.json'
                    with open(duration_file, 'w') as f:
                        json.dump({
                            'tool_name': tool_name,
                            'duration_ms': duration_ms,
                            'timestamp': input_data.get('timestamp', '')
                        }, f)
            except Exception:
                # Silently fail to not block tool execution
                pass

        sys.exit(0)
        
    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Exit cleanly on any other error
        sys.exit(0)

if __name__ == '__main__':
    main()