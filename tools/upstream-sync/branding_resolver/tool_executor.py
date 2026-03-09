"""Execute exploration tool calls against the git repository.

Provides search_codebase and read_file implementations that the LLM
can invoke during the multi-turn resolution loop.
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Output limits to prevent context explosion.
_MAX_SEARCH_CHARS = 3000
_MAX_SEARCH_RESULTS = 20
_MAX_READ_LINES = 200


def execute_tool_call(tool_name: str, args: dict[str, Any], repo_path: Path) -> str:
    """Dispatch an exploration tool call and return the result text.

    Args:
        tool_name: One of "search_codebase" or "read_file".
        args: Tool arguments parsed from the LLM response.
        repo_path: Path to the git repository root.

    Returns:
        A string result to feed back to the LLM as a tool response.
    """
    if tool_name == "search_codebase":
        return execute_search_codebase(
            pattern=args.get("pattern", ""),
            file_glob=args.get("file_glob", ""),
            repo_path=repo_path,
        )
    if tool_name == "read_file":
        return execute_read_file(
            file_path=args.get("file_path", ""),
            start_line=args.get("start_line", 1),
            end_line=args.get("end_line", 100),
            repo_path=repo_path,
        )
    return f"Unknown tool: {tool_name}"


def execute_search_codebase(
    pattern: str,
    file_glob: str,
    repo_path: Path,
) -> str:
    """Search the codebase using git grep.

    Args:
        pattern: Search pattern (supports basic regex).
        file_glob: Optional glob to limit search scope.
        repo_path: Path to the git repository root.

    Returns:
        Matching lines with file paths, or an error/empty message.
    """
    if not pattern:
        return "Error: empty search pattern."

    cmd = [
        "git", "grep", "-n", "-I",
        f"--max-count={_MAX_SEARCH_RESULTS}",
        pattern,
    ]
    if file_glob:
        cmd.extend(["--", file_glob])

    try:
        result = subprocess.run(
            cmd,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        logger.warning("search_codebase timed out for pattern: %s", pattern)
        return f"Search timed out for pattern: {pattern}"
    except OSError as exc:
        logger.warning("search_codebase failed: %s", exc)
        return f"Search error: {exc}"

    output = result.stdout.strip()
    if not output:
        return f"No results found for pattern: {pattern}"

    # Truncate if too long.
    if len(output) > _MAX_SEARCH_CHARS:
        output = output[:_MAX_SEARCH_CHARS] + "\n... (results truncated)"

    return output


def execute_read_file(
    file_path: str,
    start_line: int,
    end_line: int,
    repo_path: Path,
) -> str:
    """Read a file (or line range) from the repository at HEAD.

    Args:
        file_path: Relative path to the file.
        start_line: Starting line number (1-indexed).
        end_line: Ending line number (inclusive).
        repo_path: Path to the git repository root.

    Returns:
        Numbered file lines, or an error message.
    """
    if not file_path:
        return "Error: empty file path."

    # Clamp line range.
    start_line = max(1, start_line)
    end_line = max(start_line, end_line)
    if end_line - start_line + 1 > _MAX_READ_LINES:
        end_line = start_line + _MAX_READ_LINES - 1

    try:
        result = subprocess.run(
            ["git", "show", f"HEAD:{file_path}"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except subprocess.TimeoutExpired:
        return f"Read timed out for file: {file_path}"
    except OSError as exc:
        return f"Read error: {exc}"

    if result.returncode != 0:
        return f"File not found: {file_path}"

    lines = result.stdout.splitlines()
    # Extract the requested range (convert to 0-indexed).
    selected = lines[start_line - 1 : end_line]

    if not selected:
        return f"No content at lines {start_line}-{end_line} in {file_path} (file has {len(lines)} lines)"

    # Format with line numbers.
    numbered = [
        f"{start_line + i}: {line}" for i, line in enumerate(selected)
    ]
    return "\n".join(numbered)
