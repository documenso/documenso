"""TypeScript compilation validator using Docker-based tsc --noEmit.

Runs the TypeScript compiler inside a Docker container against the repository
and parses structured error information from the output.
"""

from __future__ import annotations

import logging
import re
import subprocess
from collections import defaultdict
from pathlib import Path

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Regex for TypeScript error lines, e.g.:
#   src/foo.ts(12,5): error TS2345: Argument of type...
_TSC_ERROR_RE = re.compile(
    r"^(?P<file>.+?)\((?P<line>\d+),(?P<col>\d+)\):\s*error\s+(?P<code>TS\d+):\s*(?P<message>.+)$",
)

# Dummy encryption keys required by the application build.
_DUMMY_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
_DUMMY_ENCRYPTION_SECONDARY_KEY = (
    "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
)

_DOCKER_TIMEOUT_SECONDS = 600  # 10 minutes


class TscError(BaseModel):
    """A single TypeScript compilation error."""

    file_path: str
    line: int
    column: int
    code: str
    message: str


def run_tsc_in_docker(repo_path: Path) -> list[TscError]:
    """Run ``tsc --noEmit`` inside a Docker container and return parsed errors.

    Args:
        repo_path: Absolute path to the repository root that will be
            volume-mounted into the container.

    Returns:
        A list of :class:`TscError` instances parsed from the compiler output.
        Returns an empty list when compilation succeeds or when Docker is
        unavailable.
    """
    repo_path = repo_path.resolve()
    logger.info("Running tsc --noEmit in Docker for %s", repo_path)

    docker_cmd = [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{repo_path}:/app",
        "-w",
        "/app",
        "-e",
        f"NEXT_PRIVATE_ENCRYPTION_KEY={_DUMMY_ENCRYPTION_KEY}",
        "-e",
        f"NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY={_DUMMY_ENCRYPTION_SECONDARY_KEY}",
        "node:22-slim",
        "bash",
        "-c",
        "npm ci --ignore-scripts 2>/dev/null && npx tsc --noEmit 2>&1",
    ]

    try:
        result = subprocess.run(
            docker_cmd,
            capture_output=True,
            text=True,
            timeout=_DOCKER_TIMEOUT_SECONDS,
        )
    except FileNotFoundError:
        logger.error("Docker is not installed or not on PATH")
        return []
    except subprocess.TimeoutExpired:
        logger.error("tsc Docker command timed out after %d seconds", _DOCKER_TIMEOUT_SECONDS)
        return []
    except OSError as exc:
        logger.error("Failed to execute Docker command: %s", exc)
        return []

    output = result.stdout or ""
    if result.returncode == 0:
        logger.info("tsc completed with no errors")
        return []

    logger.info("tsc exited with code %d, parsing errors", result.returncode)
    errors = _parse_tsc_output(output)
    logger.info("Parsed %d TypeScript error(s)", len(errors))
    return errors


def _parse_tsc_output(output: str) -> list[TscError]:
    """Parse raw tsc output into structured error objects."""
    errors: list[TscError] = []

    for line in output.splitlines():
        match = _TSC_ERROR_RE.match(line.strip())
        if match:
            errors.append(
                TscError(
                    file_path=match.group("file"),
                    line=int(match.group("line")),
                    column=int(match.group("col")),
                    code=match.group("code"),
                    message=match.group("message"),
                )
            )

    return errors


def group_errors_by_file(errors: list[TscError]) -> dict[str, list[TscError]]:
    """Group a list of TSC errors by their file path.

    Args:
        errors: Flat list of :class:`TscError` instances.

    Returns:
        A dict mapping file paths to the list of errors in that file.
    """
    grouped: dict[str, list[TscError]] = defaultdict(list)
    for error in errors:
        grouped[error.file_path].append(error)
    return dict(grouped)
