"""Diff parsing and conflict extraction utilities."""

from __future__ import annotations

import re
import subprocess
from pydantic import BaseModel, ConfigDict, Field
from pathlib import Path

MAX_CHUNK_CHARS = 300_000


class ConflictHunk(BaseModel):
    """A single conflict region within a file."""

    model_config = ConfigDict(frozen=True)

    ours: str = Field(description="Our side of the conflict")
    theirs: str = Field(description="Their side of the conflict")
    context_before: str = Field(description="Context lines before the conflict")
    context_after: str = Field(description="Context lines after the conflict")
    start_line: int = Field(description="1-indexed start line of the conflict")
    end_line: int = Field(description="1-indexed end line of the conflict")


class FileConflict(BaseModel):
    """Represents a conflicted file with all its hunks."""

    path: str = Field(description="Relative path to the conflicted file")
    hunks: list[ConflictHunk] = Field(default_factory=list, description="Conflict hunks in the file")
    full_ours: str | None = Field(default=None, description="Full file content from our side")
    full_theirs: str | None = Field(default=None, description="Full file content from their side")
    is_binary: bool = Field(default=False, description="Whether the file is binary")
    is_new_file: bool = Field(default=False, description="Whether the file is new")
    is_deleted: bool = Field(default=False, description="Whether the file is deleted")


def get_conflicted_files(repo_path: str) -> list[str]:
    """Return list of files with unresolved merge conflicts.

    Uses `git diff --name-only --diff-filter=U` to find unmerged paths.
    """
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=U"],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


_CONFLICT_START = re.compile(r"^<{7}\s+(\S+)$")
_CONFLICT_SEP = re.compile(r"^={7}$")
_CONFLICT_END = re.compile(r"^>{7}\s+(\S+)$")


def parse_conflict_markers(content: str) -> list[ConflictHunk]:
    """Parse git conflict markers from file content into ConflictHunks.

    Handles the standard three-way merge marker format:
        <<<<<<< ours
        our content
        =======
        their content
        >>>>>>> theirs
    """
    lines = content.splitlines(keepends=True)
    hunks: list[ConflictHunk] = []

    i = 0
    context_lines: list[str] = []

    while i < len(lines):
        line = lines[i].rstrip("\n\r")

        start_match = _CONFLICT_START.match(line)
        if not start_match:
            context_lines.append(lines[i])
            i += 1
            continue

        start_line = i + 1  # 1-indexed
        context_before = "".join(context_lines[-3:])

        # Collect "ours" section
        i += 1
        ours_lines: list[str] = []
        while i < len(lines):
            if _CONFLICT_SEP.match(lines[i].rstrip("\n\r")):
                break
            ours_lines.append(lines[i])
            i += 1

        # Collect "theirs" section
        i += 1
        theirs_lines: list[str] = []
        while i < len(lines):
            stripped = lines[i].rstrip("\n\r")
            if _CONFLICT_END.match(stripped):
                break
            theirs_lines.append(lines[i])
            i += 1

        end_line = i + 1  # 1-indexed

        # Collect context after
        context_after_lines: list[str] = []
        j = i + 1
        for _ in range(3):
            if j < len(lines) and not _CONFLICT_START.match(lines[j].rstrip("\n\r")):
                context_after_lines.append(lines[j])
                j += 1
            else:
                break

        hunks.append(ConflictHunk(
            ours="".join(ours_lines),
            theirs="".join(theirs_lines),
            context_before=context_before,
            context_after="".join(context_after_lines),
            start_line=start_line,
            end_line=end_line,
        ))

        context_lines = []
        i += 1

    return hunks


def get_file_at_ref(repo_path: str, ref: str, file_path: str) -> str | None:
    """Retrieve the content of a file at a specific git ref.

    Returns None if the file does not exist at that ref.
    """
    try:
        result = subprocess.run(
            ["git", "show", f"{ref}:{file_path}"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except subprocess.CalledProcessError:
        return None


def get_upstream_changed_files(
    repo_path: str,
    our_branch: str,
    upstream_branch: str,
) -> list[str]:
    """Get list of files that changed between our branch and upstream.

    Uses three-dot diff to find files changed on upstream since the
    merge base.
    """
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{our_branch}...{upstream_branch}"],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def build_file_conflict(file_path: str, repo_path: str | Path) -> FileConflict:
    """Build a FileConflict from a file with merge conflict markers.

    Reads the working-tree copy (with conflict markers) and extracts hunks.
    Also retrieves the full ours/theirs versions from git.

    Args:
        file_path: Relative path to the conflicted file.
        repo_path: Path to the repository root.

    Returns:
        A populated FileConflict.
    """
    from pathlib import Path as _Path  # noqa: PLC0415

    full_path = _Path(repo_path) / file_path
    content = full_path.read_text(encoding="utf-8", errors="replace")
    hunks = parse_conflict_markers(content)

    full_ours = get_file_at_ref(str(repo_path), "HEAD", file_path)
    full_theirs = get_file_at_ref(str(repo_path), "MERGE_HEAD", file_path)

    return FileConflict(
        path=file_path,
        hunks=hunks,
        full_ours=full_ours,
        full_theirs=full_theirs,
    )


def chunk_file_diffs(files: list[FileConflict]) -> list[list[FileConflict]]:
    """Group FileConflicts into chunks that fit within MAX_CHUNK_CHARS.

    Each chunk is sized so that the combined text content stays under
    the limit, making it suitable for batched API calls.
    """
    chunks: list[list[FileConflict]] = []
    current_chunk: list[FileConflict] = []
    current_size = 0

    for fc in files:
        file_size = sum(
            len(h.ours) + len(h.theirs) + len(h.context_before) + len(h.context_after)
            for h in fc.hunks
        )
        # Also account for full file content if present
        if fc.full_ours:
            file_size += len(fc.full_ours)
        if fc.full_theirs:
            file_size += len(fc.full_theirs)

        # Single file exceeds limit - put it in its own chunk
        if file_size >= MAX_CHUNK_CHARS:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = []
                current_size = 0
            chunks.append([fc])
            continue

        if current_size + file_size > MAX_CHUNK_CHARS:
            chunks.append(current_chunk)
            current_chunk = []
            current_size = 0

        current_chunk.append(fc)
        current_size += file_size

    if current_chunk:
        chunks.append(current_chunk)

    return chunks
