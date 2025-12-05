#!/usr/bin/env python3
"""
Tool Metadata Parser for Tier 1

Extracts relevant metadata from Claude Code tool inputs:
- File paths (Read, Edit, Write, Glob, Grep)
- Commands (Bash)
- Patterns (Grep, Glob)
- Agent types (Task)
"""

import os
import re
from typing import Dict, Any, Optional
from pathlib import Path


class ToolMetadataParser:
    """Parse tool inputs to extract relevant metadata for tracking."""

    def __init__(self, project_dir: str):
        self.project_dir = project_dir

    def _normalize_path(self, file_path: str) -> Dict[str, str]:
        """
        Normalize a file path to relative and absolute forms.

        Returns:
            Dict with absolute, relative, extension, and basename
        """
        try:
            abs_path = file_path if os.path.isabs(file_path) else os.path.join(self.project_dir, file_path)
            rel_path = os.path.relpath(abs_path, self.project_dir) if abs_path.startswith(self.project_dir) else file_path

            return {
                "filePath": abs_path,
                "filePathRelative": rel_path,
                "fileExtension": os.path.splitext(file_path)[1],
                "fileBasename": os.path.basename(file_path),
                "fileDirectory": os.path.dirname(rel_path)
            }
        except Exception:
            return {
                "filePath": file_path,
                "filePathRelative": file_path,
                "fileExtension": "",
                "fileBasename": "",
                "fileDirectory": ""
            }

    def parse_read_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Read tool."""
        file_path = tool_input.get('file_path', '')
        metadata = self._normalize_path(file_path)

        # Add Read-specific fields
        metadata['offset'] = tool_input.get('offset')
        metadata['limit'] = tool_input.get('limit')

        return metadata

    def parse_edit_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Edit tool."""
        file_path = tool_input.get('file_path', '')
        metadata = self._normalize_path(file_path)

        # Estimate lines modified
        old_string = tool_input.get('old_string', '')
        new_string = tool_input.get('new_string', '')
        metadata['linesModified'] = max(
            old_string.count('\n'),
            new_string.count('\n')
        )
        metadata['replaceAll'] = tool_input.get('replace_all', False)

        return metadata

    def parse_write_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Write tool."""
        file_path = tool_input.get('file_path', '')
        metadata = self._normalize_path(file_path)

        # Count lines in content
        content = tool_input.get('content', '')
        metadata['linesWritten'] = content.count('\n') + 1 if content else 0
        metadata['bytesWritten'] = len(content)

        return metadata

    def parse_bash_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Bash tool."""
        command = tool_input.get('command', '')

        # Extract command name (first word)
        command_parts = command.strip().split()
        command_name = command_parts[0] if command_parts else ''

        # Detect command type
        command_type = self._detect_command_type(command_name)

        return {
            "command": command,
            "commandName": command_name,
            "commandType": command_type,
            "description": tool_input.get('description', ''),
            "runInBackground": tool_input.get('run_in_background', False),
            "timeout": tool_input.get('timeout')
        }

    def _detect_command_type(self, command_name: str) -> str:
        """Categorize command by type."""
        test_commands = {'pytest', 'jest', 'npm test', 'go test', 'cargo test'}
        build_commands = {'npm', 'pnpm', 'yarn', 'make', 'cargo', 'go build', 'mvn', 'gradle'}
        git_commands = {'git'}
        lint_commands = {'eslint', 'ruff', 'mypy', 'pylint', 'clippy'}
        package_commands = {'pip', 'uv', 'npm install', 'pnpm install', 'cargo install'}

        if command_name in test_commands or 'test' in command_name:
            return 'test'
        elif command_name in build_commands or 'build' in command_name:
            return 'build'
        elif command_name in git_commands:
            return 'git'
        elif command_name in lint_commands or 'lint' in command_name:
            return 'lint'
        elif command_name in package_commands or 'install' in command_name:
            return 'package'
        elif command_name in {'ls', 'cat', 'head', 'tail', 'find', 'grep'}:
            return 'read'
        elif command_name in {'mkdir', 'touch', 'rm', 'mv', 'cp'}:
            return 'filesystem'
        else:
            return 'other'

    def parse_grep_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Grep tool."""
        return {
            "pattern": tool_input.get('pattern', ''),
            "path": tool_input.get('path', ''),
            "glob": tool_input.get('glob', ''),
            "type": tool_input.get('type', ''),
            "outputMode": tool_input.get('output_mode', 'files_with_matches'),
            "caseInsensitive": tool_input.get('-i', False),
            "multiline": tool_input.get('multiline', False)
        }

    def parse_glob_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Glob tool."""
        return {
            "pattern": tool_input.get('pattern', ''),
            "path": tool_input.get('path', '')
        }

    def parse_task_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from Task (subagent) tool."""
        return {
            "subagentType": tool_input.get('subagent_type', ''),
            "description": tool_input.get('description', ''),
            "model": tool_input.get('model', ''),
            "resume": tool_input.get('resume', '')
        }

    def parse_websearch_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from WebSearch tool."""
        return {
            "query": tool_input.get('query', ''),
            "allowedDomains": tool_input.get('allowed_domains', []),
            "blockedDomains": tool_input.get('blocked_domains', [])
        }

    def parse_webfetch_tool(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from WebFetch tool."""
        return {
            "url": tool_input.get('url', ''),
            "prompt": tool_input.get('prompt', '')
        }

    def parse_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse tool input based on tool name.

        Args:
            tool_name: Name of the tool being used
            tool_input: Tool input parameters

        Returns:
            Dict with extracted metadata
        """
        parsers = {
            'Read': self.parse_read_tool,
            'Edit': self.parse_edit_tool,
            'Write': self.parse_write_tool,
            'Bash': self.parse_bash_tool,
            'Grep': self.parse_grep_tool,
            'Glob': self.parse_glob_tool,
            'Task': self.parse_task_tool,
            'WebSearch': self.parse_websearch_tool,
            'WebFetch': self.parse_webfetch_tool,
        }

        parser = parsers.get(tool_name)
        if parser:
            try:
                return parser(tool_input)
            except Exception as e:
                return {"error": str(e)}

        # Default: return empty metadata for unknown tools
        return {}


# Standalone test
if __name__ == '__main__':
    import json

    parser = ToolMetadataParser('/Users/test/project')

    # Test Read
    print("=== Read Tool ===")
    print(json.dumps(parser.parse_tool('Read', {
        'file_path': 'src/main.py',
        'offset': 0,
        'limit': 100
    }), indent=2))

    # Test Edit
    print("\n=== Edit Tool ===")
    print(json.dumps(parser.parse_tool('Edit', {
        'file_path': '/absolute/path/config.json',
        'old_string': 'old\nvalue',
        'new_string': 'new\nvalue\nwith\nmore\nlines'
    }), indent=2))

    # Test Bash
    print("\n=== Bash Tool ===")
    print(json.dumps(parser.parse_tool('Bash', {
        'command': 'pytest tests/ -v',
        'description': 'Run unit tests'
    }), indent=2))

    # Test Grep
    print("\n=== Grep Tool ===")
    print(json.dumps(parser.parse_tool('Grep', {
        'pattern': 'class .*Service',
        'glob': '*.py',
        'output_mode': 'content',
        '-i': True
    }), indent=2))
