"""Validation of resolved file content for branding correctness and syntax."""

from __future__ import annotations

import json
import logging
import re
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .config import BrandingConfig

logger = logging.getLogger(__name__)

# Strings that, when found in resolved content, indicate an upstream brand
# leaked back in.  The validator checks surrounding context to avoid false
# positives (e.g. credit links, package scopes).
_UPSTREAM_BRAND_STRINGS = [
    "Documenso",
    "documenso.com",
    "#7AC455",  # upstream green
    "noreply@documenso.com",
    "support@documenso.com",
    "DOCUMENSO_INTERNAL_EMAIL",
    "documenso/documenso",  # Docker image
]

# Substrings that, when found near an upstream brand match, indicate a
# legitimate preservation (credit link, package scope, internal Tailwind key).
_BRANDING_PRESERVATIONS = [
    "@documenso/",  # package scope
    "github.com/documenso",  # upstream credit link
    "documenso.com/blog",  # credit link
    "documenso.com/oss",  # credit link
    "// upstream:",  # explicit comment
    "/* upstream",  # explicit comment
    "color key",  # Tailwind color key comment
    "'documenso'",  # Tailwind color key in JS
    '"documenso"',  # Tailwind color key in JSON/JS
]

_CONFLICT_MARKERS = ["<<<<<<<", "=======", ">>>>>>>"]

# Extension groups for syntax checking.
_JS_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"}
_JSON_EXTENSIONS = {".json"}
_YAML_EXTENSIONS = {".yml", ".yaml"}
_CSS_EXTENSIONS = {".css"}


def validate_resolved_file(
    file_path: str,
    content: str,
    config: BrandingConfig,
) -> list[str]:
    """Validate resolved file content for branding and syntax issues.

    Args:
        file_path: Path to the file being validated.
        content: The resolved file content.
        config: Branding configuration for substitution rules.

    Returns:
        A list of error strings.  Empty means the file passed validation.
    """
    errors: list[str] = []

    errors.extend(_check_branding_reversion(content, config))
    errors.extend(_check_conflict_markers(content))
    errors.extend(_check_syntax(file_path, content))

    return errors


# ---------------------------------------------------------------------------
# Branding reversion check
# ---------------------------------------------------------------------------

def _check_branding_reversion(content: str, config: BrandingConfig) -> list[str]:
    """Detect upstream brand strings that should have been replaced.

    Preservation is determined per-line: if the line containing the match
    also contains any preservation substring (e.g. ``@documenso/``,
    ``github.com/documenso``), the match is treated as legitimate.  This
    is wider than the old 30-char window, which false-positived on credit
    lines like ``[Documenso](https://github.com/documenso/documenso)`` where
    the URL sat just outside the window.
    """
    errors: list[str] = []
    lines = content.splitlines()

    # Build a line-start offset table so we can compute line numbers quickly.
    line_starts: list[int] = [0]
    for line in lines[:-1]:
        line_starts.append(line_starts[-1] + len(line) + 1)

    def line_at(offset: int) -> int:
        # Binary-search would be tidier but linear is fine for typical file sizes.
        for i in range(len(line_starts) - 1, -1, -1):
            if line_starts[i] <= offset:
                return i
        return 0

    for brand_string in _UPSTREAM_BRAND_STRINGS:
        start = 0
        while True:
            idx = content.find(brand_string, start)
            if idx == -1:
                break

            line_no = line_at(idx)
            line_text = lines[line_no] if line_no < len(lines) else ""

            if not _line_is_preserved(line_text):
                errors.append(
                    f"Upstream brand string '{brand_string}' found at line "
                    f"{line_no + 1} (not in a preserved context)"
                )

            start = idx + len(brand_string)

    return errors


def _line_is_preserved(line: str) -> bool:
    """Return True if the line contains any preservation substring."""
    return any(pres in line for pres in _BRANDING_PRESERVATIONS)


# ---------------------------------------------------------------------------
# Conflict marker check
# ---------------------------------------------------------------------------

def _check_conflict_markers(content: str) -> list[str]:
    """Detect leftover merge conflict markers."""
    errors: list[str] = []
    for i, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        for marker in _CONFLICT_MARKERS:
            if stripped.startswith(marker):
                errors.append(f"Conflict marker '{marker}' found at line {i}")
    return errors


# ---------------------------------------------------------------------------
# Syntax checks by file extension
# ---------------------------------------------------------------------------

def _check_syntax(file_path: str, content: str) -> list[str]:
    ext = Path(file_path).suffix.lower()

    # Skip naive bracket checking for .tsx/.jsx — JSX syntax causes false
    # positives. Real syntax validation comes from tsc --noEmit instead.
    if ext in {".ts", ".js", ".cjs", ".mjs"}:
        return _check_js_brackets(content)
    if ext in {".tsx", ".jsx"}:
        return []  # JSX confuses the bracket checker; rely on tsc
    if ext in _JSON_EXTENSIONS:
        return _check_json(content)
    if ext in _YAML_EXTENSIONS:
        return _check_yaml(content)
    if ext in _CSS_EXTENSIONS:
        return _check_css_braces(content)

    return []


def _check_js_brackets(content: str) -> list[str]:
    """Check bracket/brace/paren matching in JS/TS files.

    Uses a simple state machine that tracks string literals and template
    literals to avoid counting brackets inside strings.
    """
    errors: list[str] = []
    stack: list[str] = []
    match_map = {")": "(", "]": "[", "}": "{"}
    openers = set(match_map.values())
    closers = set(match_map.keys())

    i = 0
    length = len(content)
    while i < length:
        ch = content[i]

        # Skip single-line comments.
        if ch == "/" and i + 1 < length and content[i + 1] == "/":
            i = content.find("\n", i)
            if i == -1:
                break
            i += 1
            continue

        # Skip multi-line comments.
        if ch == "/" and i + 1 < length and content[i + 1] == "*":
            end = content.find("*/", i + 2)
            i = end + 2 if end != -1 else length
            continue

        # Skip string literals (single, double, backtick).
        if ch in ('"', "'", "`"):
            quote = ch
            i += 1
            while i < length:
                c = content[i]
                if c == "\\" and i + 1 < length:
                    i += 2  # skip escaped char
                    continue
                if c == quote:
                    break
                i += 1
            i += 1
            continue

        # Skip regex literals (heuristic: after =, (, [, !, &, |, ;, ,, {, :).
        if ch == "/" and i > 0:
            prev = content[:i].rstrip()
            if prev and prev[-1] in "=([!&|;,{:?+->~^%":
                i += 1
                while i < length:
                    c = content[i]
                    if c == "\\":
                        i += 2
                        continue
                    if c == "/":
                        break
                    if c == "\n":
                        break  # not a regex
                    i += 1
                i += 1
                continue

        if ch in openers:
            stack.append(ch)
        elif ch in closers:
            expected = match_map[ch]
            if not stack:
                line_no = content[:i].count("\n") + 1
                errors.append(f"Unmatched closing '{ch}' at line {line_no}")
            elif stack[-1] != expected:
                line_no = content[:i].count("\n") + 1
                errors.append(
                    f"Mismatched bracket: expected closing for '{stack[-1]}', "
                    f"got '{ch}' at line {line_no}"
                )
                stack.pop()
            else:
                stack.pop()

        i += 1

    if stack:
        errors.append(f"Unclosed brackets at end of file: {stack}")

    return errors


def _check_json(content: str) -> list[str]:
    """Validate JSON syntax."""
    try:
        json.loads(content)
    except json.JSONDecodeError as exc:
        return [f"Invalid JSON: {exc}"]
    return []


def _check_yaml(content: str) -> list[str]:
    """Validate YAML syntax."""
    try:
        import yaml  # noqa: PLC0415 — optional dependency

        yaml.safe_load(content)
    except ImportError:
        return []  # yaml not available, skip check
    except yaml.YAMLError as exc:
        return [f"Invalid YAML: {exc}"]
    return []


def _check_css_braces(content: str) -> list[str]:
    """Check that CSS braces are balanced."""
    # Strip comments first.
    cleaned = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
    open_count = cleaned.count("{")
    close_count = cleaned.count("}")
    if open_count != close_count:
        return [
            f"Unbalanced CSS braces: {open_count} opening vs {close_count} closing"
        ]
    return []


# ---------------------------------------------------------------------------
# Auto-formatting for the self-healing repair loop
# ---------------------------------------------------------------------------

_PRETTIER_EXTENSIONS = _JS_EXTENSIONS | _CSS_EXTENSIONS | _JSON_EXTENSIONS


def auto_format_file(file_path: str, content: str, repo_path: Path) -> str:
    """Run the appropriate auto-formatter on file content.

    Writes the content to disk, runs the formatter, and reads back the result.
    Returns the original content unchanged if no formatter is available or if
    the formatter fails.

    Args:
        file_path: Relative path to the file.
        content: The file content to format.
        repo_path: Path to the repository root.

    Returns:
        The formatted content, or the original if formatting failed.
    """
    ext = Path(file_path).suffix.lower()

    if ext in _PRETTIER_EXTENSIONS:
        return _run_prettier(file_path, content, repo_path)

    if ext in _YAML_EXTENSIONS:
        return _format_yaml(content)

    return content


def _run_prettier(file_path: str, content: str, repo_path: Path) -> str:
    """Format a file using prettier via npx."""
    full_path = repo_path / file_path
    original = content

    try:
        full_path.write_text(content, encoding="utf-8")

        result = subprocess.run(
            ["npx", "prettier", "--write", str(full_path)],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            logger.warning(
                "prettier failed for %s: %s", file_path, result.stderr[:200]
            )
            return original

        formatted = full_path.read_text(encoding="utf-8")
        logger.debug("prettier formatted %s", file_path)
        return formatted

    except subprocess.TimeoutExpired:
        logger.warning("prettier timed out for %s", file_path)
        return original
    except OSError as exc:
        logger.warning("prettier error for %s: %s", file_path, exc)
        return original


def _format_yaml(content: str) -> str:
    """Re-serialize YAML to fix formatting issues."""
    try:
        import yaml  # noqa: PLC0415

        parsed = yaml.safe_load(content)
        if parsed is None:
            return content
        return yaml.safe_dump(parsed, default_flow_style=False, allow_unicode=True)
    except Exception:
        return content
