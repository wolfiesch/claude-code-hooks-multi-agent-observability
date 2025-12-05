#!/usr/bin/env python3
"""
Shared utilities for extracting general-purpose metadata.

Tier 0: Essential Context
- Git context (branch, commit, dirty status, remote tracking)
- Session context (start time, duration, model, working directory)
- Environment context (OS, shell, Python/Node versions)
"""

import os
import subprocess
import platform
import json
import sys
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pathlib import Path


class MetadataCollector:
    """Collect universal metadata about the Claude Code session."""

    # Singleton state file for session tracking
    STATE_FILE = Path.home() / '.claude-observability-state.json'

    def __init__(self, project_dir: str):
        self.project_dir = project_dir
        self._state = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        """Load persistent state from file."""
        try:
            if self.STATE_FILE.exists():
                with open(self.STATE_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load state: {e}", file=sys.stderr)
        return {}

    def _save_state(self):
        """Save persistent state to file."""
        try:
            with open(self.STATE_FILE, 'w') as f:
                json.dump(self._state, f)
        except Exception as e:
            print(f"Warning: Could not save state: {e}", file=sys.stderr)

    def _get_session_key(self, session_id: str) -> str:
        """Get unique key for this session."""
        return f"session_{session_id}"

    def get_git_context(self) -> Dict[str, Any]:
        """
        Extract git repository context.

        Returns:
            Dict with git metadata or error information.
        """
        try:
            # Check if we're in a git repository
            subprocess.run(
                ['git', 'rev-parse', '--git-dir'],
                cwd=self.project_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return {"isGitRepo": False}

        git_info = {"isGitRepo": True}

        try:
            # Current branch
            branch = subprocess.check_output(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                cwd=self.project_dir,
                stderr=subprocess.DEVNULL,
                text=True
            ).strip()
            git_info['branch'] = branch
        except Exception:
            git_info['branch'] = None

        try:
            # Current commit hash (short)
            commit_hash = subprocess.check_output(
                ['git', 'rev-parse', '--short', 'HEAD'],
                cwd=self.project_dir,
                stderr=subprocess.DEVNULL,
                text=True
            ).strip()
            git_info['commitHash'] = commit_hash
        except Exception:
            git_info['commitHash'] = None

        try:
            # Check for uncommitted changes
            status = subprocess.check_output(
                ['git', 'status', '--porcelain'],
                cwd=self.project_dir,
                stderr=subprocess.DEVNULL,
                text=True
            )
            git_info['isDirty'] = len(status.strip()) > 0

            # Count staged and unstaged files
            staged = len([line for line in status.split('\n') if line.startswith(('M ', 'A ', 'D '))])
            unstaged = len([line for line in status.split('\n') if line.startswith(' M')])
            git_info['stagedFiles'] = staged
            git_info['unstagedFiles'] = unstaged
        except Exception:
            git_info['isDirty'] = None

        try:
            # Remote tracking branch
            remote_branch = subprocess.check_output(
                ['git', 'rev-parse', '--abbrev-ref', '@{upstream}'],
                cwd=self.project_dir,
                stderr=subprocess.DEVNULL,
                text=True
            ).strip()
            git_info['remoteBranch'] = remote_branch
        except Exception:
            git_info['remoteBranch'] = None

        try:
            # Commits ahead/behind remote
            if git_info.get('remoteBranch'):
                ahead_behind = subprocess.check_output(
                    ['git', 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
                    cwd=self.project_dir,
                    stderr=subprocess.DEVNULL,
                    text=True
                ).strip().split()
                git_info['commitsAhead'] = int(ahead_behind[0])
                git_info['commitsBehind'] = int(ahead_behind[1])
            else:
                git_info['commitsAhead'] = 0
                git_info['commitsBehind'] = 0
        except Exception:
            git_info['commitsAhead'] = 0
            git_info['commitsBehind'] = 0

        return git_info

    def get_session_context(self, session_id: str, model_name: str = None) -> Dict[str, Any]:
        """
        Extract session context.

        Tracks session start time and calculates duration.
        Uses persistent state file to track across hook invocations.

        Args:
            session_id: Unique session identifier
            model_name: Optional model name from transcript (e.g., 'claude-sonnet-4-5-20250929')

        Returns:
            Dict with session metadata
        """
        session_key = self._get_session_key(session_id)

        # Initialize session if first time seeing it
        if session_key not in self._state:
            self._state[session_key] = {
                'startTime': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'toolCount': 0
            }
            self._save_state()

        session_data = self._state[session_key]
        start_time = datetime.fromisoformat(session_data['startTime'].replace('Z', '+00:00'))
        # Ensure both datetimes are timezone-aware for subtraction
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        duration = (datetime.now(timezone.utc) - start_time).total_seconds() / 60

        # Use provided model_name or fall back to environment variable
        model = model_name or os.environ.get('CLAUDE_MODEL', 'unknown')

        # Extract just the model name for readability
        if 'sonnet' in model.lower():
            model_short = 'Sonnet 4.5'
        elif 'opus' in model.lower():
            model_short = 'Opus 4.5'
        elif 'haiku' in model.lower():
            model_short = 'Haiku 4.5'
        else:
            model_short = model

        return {
            "startTime": session_data['startTime'],
            "durationMinutes": round(duration, 1),
            "model": model,
            "modelShort": model_short,
            "workingDirectory": self.project_dir,
            "workingDirectoryName": os.path.basename(self.project_dir),
            "sessionId": session_id,
            "toolCount": session_data.get('toolCount', 0)
        }

    def increment_tool_count(self, session_id: str):
        """Increment tool count for this session."""
        session_key = self._get_session_key(session_id)
        if session_key in self._state:
            self._state[session_key]['toolCount'] = self._state[session_key].get('toolCount', 0) + 1
            self._save_state()

    def get_environment_context(self) -> Dict[str, Any]:
        """
        Extract environment context.

        Returns:
            Dict with environment metadata
        """
        env = {
            "os": platform.system().lower(),
            "osVersion": platform.release(),
            "shell": os.environ.get('SHELL', '').split('/')[-1],
            "user": os.environ.get('USER', 'unknown'),
        }

        # Detect Python version (try multiple commands)
        for python_cmd in ['python3', 'python']:
            try:
                python_version = subprocess.check_output(
                    [python_cmd, '--version'],
                    stderr=subprocess.STDOUT,
                    text=True
                ).strip().replace('Python ', '')
                env['pythonVersion'] = python_version
                break
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue

        # Detect Node version
        try:
            node_version = subprocess.check_output(
                ['node', '--version'],
                stderr=subprocess.STDOUT,
                text=True
            ).strip().replace('v', '')
            env['nodeVersion'] = node_version
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        # Detect Go version
        try:
            go_version = subprocess.check_output(
                ['go', 'version'],
                stderr=subprocess.STDOUT,
                text=True
            ).strip().split()[2].replace('go', '')
            env['goVersion'] = go_version
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        # Detect Rust version
        try:
            rust_version = subprocess.check_output(
                ['rustc', '--version'],
                stderr=subprocess.STDOUT,
                text=True
            ).strip().split()[1]
            env['rustVersion'] = rust_version
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        return env

    def record_tool_start(self, session_id: str, tool_name: str, tool_input: Dict[str, Any]):
        """
        Record tool start time for duration tracking (Tier 1).

        Args:
            session_id: Unique session identifier
            tool_name: Name of the tool being used
            tool_input: Tool input parameters
        """
        session_key = self._get_session_key(session_id)
        if session_key not in self._state:
            self._state[session_key] = {'startTime': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'toolCount': 0}

        # Store tool start time with unique ID (timestamp + tool name)
        tool_start_key = f"tool_start_{time.time()}_{tool_name}"
        if 'toolStarts' not in self._state[session_key]:
            self._state[session_key]['toolStarts'] = {}

        self._state[session_key]['toolStarts'][tool_start_key] = {
            'toolName': tool_name,
            'startTime': time.time(),
            'toolInput': tool_input
        }

        # Keep only last 10 tool starts to prevent memory growth
        if len(self._state[session_key]['toolStarts']) > 10:
            oldest_key = min(self._state[session_key]['toolStarts'].keys())
            del self._state[session_key]['toolStarts'][oldest_key]

        self._save_state()

    def record_tool_end(self, session_id: str, tool_name: str) -> Optional[float]:
        """
        Record tool end and calculate duration (Tier 1).

        Args:
            session_id: Unique session identifier
            tool_name: Name of the tool that completed

        Returns:
            Duration in milliseconds, or None if no matching start found
        """
        session_key = self._get_session_key(session_id)
        if session_key not in self._state or 'toolStarts' not in self._state[session_key]:
            return None

        # Find most recent start for this tool
        tool_starts = self._state[session_key]['toolStarts']
        matching_starts = [(k, v) for k, v in tool_starts.items() if v['toolName'] == tool_name]

        if not matching_starts:
            return None

        # Get most recent start
        start_key, start_data = max(matching_starts, key=lambda x: x[1]['startTime'])
        duration_ms = (time.time() - start_data['startTime']) * 1000

        # Update session stats
        self._update_session_stats(session_key, tool_name, duration_ms, start_data.get('toolInput', {}))

        # Remove the start entry
        del self._state[session_key]['toolStarts'][start_key]
        self._save_state()

        return round(duration_ms, 2)

    def record_todos(self, session_id: str, todos: List[Dict[str, Any]]):
        """
        Record TodoWrite updates for session tracking.

        Args:
            session_id: Unique session identifier
            todos: List of todo items with content, status, and activeForm
        """
        session_key = self._get_session_key(session_id)
        if session_key not in self._state:
            self._state[session_key] = {
                'startTime': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'toolCount': 0
            }

        # Store todos with timestamp
        self._state[session_key]['todos'] = todos
        self._state[session_key]['lastToolTimestamp'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        self._save_state()

    def _update_session_stats(self, session_key: str, tool_name: str, duration_ms: float, tool_input: Dict[str, Any]):
        """Update cumulative session statistics."""
        if 'stats' not in self._state[session_key]:
            self._state[session_key]['stats'] = {
                'toolsExecuted': 0,
                'filesRead': 0,
                'filesWritten': 0,
                'filesEdited': 0,
                'bashCommandsRun': 0,
                'testsRun': 0,
                'totalToolTimeMs': 0,
                'errorCount': 0,
                'grepSearches': 0,
                'globSearches': 0,
                'subagentsLaunched': 0,
                'webSearches': 0,
                'webFetches': 0
            }

        stats = self._state[session_key]['stats']
        stats['toolsExecuted'] += 1
        stats['totalToolTimeMs'] += duration_ms

        # Update tool-specific counters
        if tool_name == 'Read':
            stats['filesRead'] += 1
        elif tool_name == 'Write':
            stats['filesWritten'] += 1
        elif tool_name == 'Edit':
            stats['filesEdited'] += 1
        elif tool_name == 'Bash':
            stats['bashCommandsRun'] += 1
            # Detect test commands
            command = tool_input.get('command', '').lower()
            if any(test_cmd in command for test_cmd in ['pytest', 'jest', 'test', 'go test']):
                stats['testsRun'] += 1
        elif tool_name == 'Grep':
            stats['grepSearches'] += 1
        elif tool_name == 'Glob':
            stats['globSearches'] += 1
        elif tool_name == 'Task':
            stats['subagentsLaunched'] += 1
        elif tool_name == 'WebSearch':
            stats['webSearches'] += 1
        elif tool_name == 'WebFetch':
            stats['webFetches'] += 1

    def get_tool_metadata(self, session_id: str, tool_name: str, tool_input: Dict[str, Any], duration_ms: Optional[float] = None) -> Dict[str, Any]:
        """
        Get tool-specific metadata with duration (Tier 1).

        Args:
            session_id: Unique session identifier
            tool_name: Name of the tool
            tool_input: Tool input parameters
            duration_ms: Tool duration in milliseconds (if PostToolUse)

        Returns:
            Dict with tool metadata
        """
        metadata = {
            "name": tool_name,
            "durationMs": duration_ms,
            "success": duration_ms is not None  # Assume success if we have duration
        }

        # Parse tool-specific metadata
        try:
            from tool_metadata_parser import ToolMetadataParser
            parser = ToolMetadataParser(self.project_dir)
            tool_specific = parser.parse_tool(tool_name, tool_input)
            metadata["metadata"] = tool_specific
        except ImportError:
            # Graceful fallback if parser not available
            metadata["metadata"] = {}
        except Exception as e:
            metadata["metadata"] = {"parseError": str(e)}

        return metadata

    def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """
        Get cumulative session statistics (Tier 1).

        Args:
            session_id: Unique session identifier

        Returns:
            Dict with session statistics
        """
        session_key = self._get_session_key(session_id)
        if session_key not in self._state or 'stats' not in self._state[session_key]:
            return {
                'toolsExecuted': 0,
                'filesRead': 0,
                'filesWritten': 0,
                'filesEdited': 0,
                'bashCommandsRun': 0,
                'testsRun': 0,
                'totalToolTimeMs': 0,
                'avgToolTimeMs': 0,
                'errorCount': 0
            }

        stats = self._state[session_key]['stats'].copy()

        # Calculate average tool time
        if stats['toolsExecuted'] > 0:
            stats['avgToolTimeMs'] = round(stats['totalToolTimeMs'] / stats['toolsExecuted'], 2)
        else:
            stats['avgToolTimeMs'] = 0

        return stats

    def collect_tier0_metadata(self, session_id: str, model_name: str = None) -> Dict[str, Any]:
        """
        Collect all Tier 0 metadata.

        Args:
            session_id: Unique session identifier
            model_name: Optional model name from transcript

        Returns:
            Dict with all Tier 0 metadata fields
        """
        return {
            "git": self.get_git_context(),
            "session": self.get_session_context(session_id, model_name),
            "environment": self.get_environment_context()
        }

    def collect_tier1_metadata(self, session_id: str, tool_name: str = None, tool_input: Dict[str, Any] = None, duration_ms: Optional[float] = None) -> Dict[str, Any]:
        """
        Collect Tier 1 metadata (tool performance & file tracking).

        Args:
            session_id: Unique session identifier
            tool_name: Name of the tool (if applicable)
            tool_input: Tool input parameters (if applicable)
            duration_ms: Tool duration in milliseconds (if PostToolUse)

        Returns:
            Dict with Tier 1 metadata fields
        """
        metadata = {
            "sessionStats": self.get_session_stats(session_id)
        }

        # Add tool-specific metadata if tool info provided
        if tool_name and tool_input is not None:
            metadata["tool"] = self.get_tool_metadata(session_id, tool_name, tool_input, duration_ms)

        return metadata

    def collect_tier2_metadata(self, session_id: str, tool_name: str = None, tool_input: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Collect Tier 2 metadata (workflow intelligence).

        Args:
            session_id: Unique session identifier
            tool_name: Name of the tool being used
            tool_input: Tool input parameters

        Returns:
            Dict with Tier 2 metadata fields
        """
        try:
            # Import Tier 2 collector
            from workflow_intelligence import WorkflowIntelligence

            # Get recent tool history for pattern detection
            session_key = self._get_session_key(session_id)
            session_data = self._state.get(session_key, {})
            recent_tools = session_data.get('toolHistory', [])[-20:]  # Last 20 tools

            # Collect Tier 2 metadata
            tier2_collector = WorkflowIntelligence(self.project_dir)
            return tier2_collector.collect_tier2_metadata(
                session_id,
                tool_name or 'Unknown',
                tool_input or {},
                recent_tools
            )
        except Exception as e:
            print(f"Warning: Could not collect Tier 2 metadata: {e}", file=sys.stderr)
            return {}

    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Remove sessions older than max_age_hours from state."""
        try:
            now = datetime.now(timezone.utc)
            to_delete = []

            for key, value in self._state.items():
                if key.startswith('session_'):
                    start_time = datetime.fromisoformat(value['startTime'].replace('Z', '+00:00'))
                    age_hours = (now - start_time.replace(tzinfo=None)).total_seconds() / 3600
                    if age_hours > max_age_hours:
                        to_delete.append(key)

            for key in to_delete:
                del self._state[key]

            if to_delete:
                self._save_state()
        except Exception as e:
            print(f"Warning: Could not cleanup old sessions: {e}", file=sys.stderr)


# Standalone test
if __name__ == '__main__':
    import sys

    # Test with current directory
    project_dir = os.getcwd()
    collector = MetadataCollector(project_dir)

    print("Testing MetadataCollector...")
    print("\n=== Git Context ===")
    print(json.dumps(collector.get_git_context(), indent=2))

    print("\n=== Session Context ===")
    print(json.dumps(collector.get_session_context('test-session-123'), indent=2))

    print("\n=== Environment Context ===")
    print(json.dumps(collector.get_environment_context(), indent=2))

    print("\n=== Full Tier 0 Metadata ===")
    print(json.dumps(collector.collect_tier0_metadata('test-session-123'), indent=2))
