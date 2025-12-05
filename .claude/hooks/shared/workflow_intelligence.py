"""
Tier 2: Workflow Intelligence Metadata Collector

Provides workflow-level insights by analyzing:
- Phase detection (planning, implementation, debugging, etc.)
- Project type detection (web app, API, library, etc.)
- TodoWrite progress tracking
- Skill usage patterns
- Workflow patterns (TDD, iterative, etc.)
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


class WorkflowIntelligence:
    """Collects Tier 2 workflow intelligence metadata."""

    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.state_file = Path.home() / '.claude-observability-state.json'

    def detect_phase(self, tool_name: str, tool_input: Dict, recent_tools: List[str]) -> Dict[str, Any]:
        """
        Detect current workflow phase based on tool usage patterns.

        Phases:
        - planning: Reading files, exploring codebase, Ask/Task tools
        - implementation: Write/Edit tools, frequent file modifications
        - debugging: Read + Bash (tests), grep for errors, BashOutput
        - refactoring: Edit with pattern changes, multiple file edits
        - documentation: Writing .md files, README updates
        - testing: Running tests, pytest, npm test, etc.
        """

        phase = "unknown"
        confidence = 0.5
        indicators = []

        # Planning indicators
        if tool_name in ['Read', 'Glob', 'Grep', 'Task']:
            if 'plan' in str(tool_input).lower() or 'explore' in str(tool_input).lower():
                phase = "planning"
                confidence = 0.85
                indicators.append(f"{tool_name} tool suggests exploration")

        # Implementation indicators
        if tool_name in ['Write', 'Edit']:
            if not any(ext in str(tool_input) for ext in ['.md', '.txt']):
                phase = "implementation"
                confidence = 0.80
                indicators.append(f"{tool_name} tool on code files")

                # Higher confidence if multiple edits recently
                if recent_tools.count('Edit') + recent_tools.count('Write') > 2:
                    confidence = 0.90
                    indicators.append("Multiple consecutive file modifications")

        # Debugging indicators
        if tool_name == 'Bash':
            command = tool_input.get('command', '')
            if any(kw in command for kw in ['pytest', 'test', 'npm test', 'cargo test']):
                phase = "testing"
                confidence = 0.95
                indicators.append("Running test suite")
            elif any(kw in command for kw in ['python', 'node', 'cargo run']):
                phase = "debugging"
                confidence = 0.75
                indicators.append("Executing code for debugging")

        if tool_name == 'BashOutput':
            phase = "debugging"
            confidence = 0.70
            indicators.append("Monitoring command output")

        # Documentation indicators
        if tool_name in ['Write', 'Edit']:
            file_path = tool_input.get('file_path', '')
            if file_path.endswith(('.md', '.rst', '.txt')) or 'README' in file_path:
                phase = "documentation"
                confidence = 0.90
                indicators.append("Writing documentation files")

        # Refactoring indicators
        if tool_name == 'Edit':
            if 'replace_all' in tool_input and tool_input.get('replace_all'):
                phase = "refactoring"
                confidence = 0.85
                indicators.append("Global replace suggests refactoring")

        return {
            "phase": phase,
            "confidence": confidence,
            "indicators": indicators
        }

    def detect_project_type(self) -> Dict[str, Any]:
        """
        Detect project type based on files and structure.

        Project types:
        - web_application: Has HTML/CSS/JS, frontend frameworks
        - api_server: Has API routes, server code, no frontend
        - cli_tool: Has CLI entry point, argparse/click
        - library: Has setup.py/pyproject.toml, no main entry
        - data_pipeline: Has data processing, ETL scripts
        - mobile_app: Has iOS/Android project files
        - desktop_app: Has Electron/Qt/GTK files
        """

        project_type = "unknown"
        confidence = 0.5
        frameworks = []
        primary_language = None

        # Check for common project indicators
        project_files = {
            'package.json': 0,
            'pyproject.toml': 0,
            'Cargo.toml': 0,
            'go.mod': 0,
            'pom.xml': 0
        }

        for file, _ in project_files.items():
            if (self.project_dir / file).exists():
                project_files[file] = 1

        # Detect language
        if project_files['package.json']:
            primary_language = 'JavaScript/TypeScript'
        elif project_files['pyproject.toml']:
            primary_language = 'Python'
        elif project_files['Cargo.toml']:
            primary_language = 'Rust'
        elif project_files['go.mod']:
            primary_language = 'Go'

        # Detect project type
        if (self.project_dir / 'frontend').exists() or (self.project_dir / 'public').exists():
            project_type = 'web_application'
            confidence = 0.85
        elif (self.project_dir / 'backend').exists() or (self.project_dir / 'api').exists():
            project_type = 'api_server'
            confidence = 0.80
        elif (self.project_dir / 'src' / 'main.py').exists() or (self.project_dir / 'cli.py').exists():
            project_type = 'cli_tool'
            confidence = 0.75

        # Detect frameworks
        if project_files['package.json']:
            try:
                with open(self.project_dir / 'package.json') as f:
                    pkg = json.load(f)
                    deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}

                    if 'react' in deps:
                        frameworks.append('React')
                    if 'vue' in deps:
                        frameworks.append('Vue')
                    if 'next' in deps:
                        frameworks.append('Next.js')
                    if 'express' in deps:
                        frameworks.append('Express')
            except:
                pass

        if project_files['pyproject.toml']:
            try:
                with open(self.project_dir / 'pyproject.toml') as f:
                    content = f.read()
                    if 'fastapi' in content.lower():
                        frameworks.append('FastAPI')
                    if 'flask' in content.lower():
                        frameworks.append('Flask')
                    if 'django' in content.lower():
                        frameworks.append('Django')
            except:
                pass

        return {
            "projectType": project_type,
            "primaryLanguage": primary_language,
            "frameworks": frameworks,
            "confidence": confidence
        }

    def get_todo_tracking(self, session_id: str) -> Dict[str, Any]:
        """
        Track TodoWrite progress from session state.
        """

        try:
            if not self.state_file.exists():
                return {
                    "totalTodos": 0,
                    "completedTodos": 0,
                    "inProgressTodos": 0,
                    "pendingTodos": 0,
                    "completionRate": 0.0,
                    "lastUpdate": None
                }

            with open(self.state_file, 'r') as f:
                state = json.load(f)

            session_state = state.get('sessions', {}).get(session_id, {})
            todos = session_state.get('todos', [])

            if not todos:
                return {
                    "totalTodos": 0,
                    "completedTodos": 0,
                    "inProgressTodos": 0,
                    "pendingTodos": 0,
                    "completionRate": 0.0,
                    "lastUpdate": None
                }

            completed = sum(1 for t in todos if t.get('status') == 'completed')
            in_progress = sum(1 for t in todos if t.get('status') == 'in_progress')
            pending = sum(1 for t in todos if t.get('status') == 'pending')
            total = len(todos)

            completion_rate = completed / total if total > 0 else 0.0

            return {
                "totalTodos": total,
                "completedTodos": completed,
                "inProgressTodos": in_progress,
                "pendingTodos": pending,
                "completionRate": round(completion_rate, 2),
                "lastUpdate": session_state.get('lastToolTimestamp')
            }
        except Exception:
            return {
                "totalTodos": 0,
                "completedTodos": 0,
                "inProgressTodos": 0,
                "pendingTodos": 0,
                "completionRate": 0.0,
                "lastUpdate": None
            }

    def get_skill_usage(self, session_id: str, tool_name: str, tool_input: Dict) -> Dict[str, Any]:
        """
        Track skill invocations and usage patterns.
        """

        active_skills = []
        skill_count = 0
        last_skill = None
        last_skill_time = None

        # Check if current tool is a Skill invocation
        if tool_name == 'Skill':
            skill_name = tool_input.get('skill', '')
            if skill_name:
                active_skills.append(skill_name)
                last_skill = skill_name
                last_skill_time = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

        # Load skill history from state
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    state = json.load(f)

                session_state = state.get('sessions', {}).get(session_id, {})
                skill_history = session_state.get('skillHistory', [])
                skill_count = len(skill_history)

                if skill_history:
                    last_entry = skill_history[-1]
                    last_skill = last_entry.get('skillName')
                    last_skill_time = last_entry.get('timestamp')
        except:
            pass

        return {
            "activeSkills": active_skills,
            "skillInvocationCount": skill_count,
            "lastSkillUsed": last_skill,
            "lastSkillTimestamp": last_skill_time
        }

    def detect_workflow_patterns(self, session_id: str, recent_tools: List[str]) -> Dict[str, Any]:
        """
        Detect workflow patterns based on tool usage sequences.
        """

        # Iterative development: Many Read-Edit-Read cycles
        read_edit_cycles = 0
        for i in range(len(recent_tools) - 2):
            if recent_tools[i:i+3] == ['Read', 'Edit', 'Read']:
                read_edit_cycles += 1

        is_iterative = read_edit_cycles > 2

        # Test-driven development: Test runs before implementations
        has_tdd_pattern = False
        for i in range(len(recent_tools) - 1):
            if recent_tools[i] == 'Bash' and recent_tools[i+1] in ['Write', 'Edit']:
                # Could be TDD (test first, then implement)
                has_tdd_pattern = True
                break

        # Frequent refactoring: Many Edit operations with replace_all
        edit_count = recent_tools.count('Edit')
        frequent_refactoring = edit_count > 5

        # Parallel tasking: Task tool invocations
        parallel_tasking = recent_tools.count('Task') > 1

        return {
            "isIterativeDevelopment": is_iterative,
            "testDrivenDevelopment": has_tdd_pattern,
            "frequentRefactoring": frequent_refactoring,
            "parallelTasking": parallel_tasking
        }

    def collect_tier2_metadata(
        self,
        session_id: str,
        tool_name: str,
        tool_input: Dict,
        recent_tools: List[str]
    ) -> Dict[str, Any]:
        """
        Collect all Tier 2 workflow intelligence metadata.
        """

        return {
            "workflowPhase": self.detect_phase(tool_name, tool_input, recent_tools),
            "projectContext": self.detect_project_type(),
            "todoTracking": self.get_todo_tracking(session_id),
            "skillUsage": self.get_skill_usage(session_id, tool_name, tool_input),
            "workflowPatterns": self.detect_workflow_patterns(session_id, recent_tools)
        }
