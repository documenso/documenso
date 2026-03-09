"""Validation of resolved file content for branding correctness and syntax."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .config import BrandingConfig

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
    """Detect upstream brand strings that should have been replaced."""
    errors: list[str] = []

    for brand_string in _UPSTREAM_BRAND_STRINGS:
        start = 0
        while True:
            idx = content.find(brand_string, start)
            if idx == -1:
                break

            # Check surrounding context (30 chars each side) for preservations.
            ctx_start = max(0, idx - 30)
            ctx_end = min(len(content), idx + len(brand_string) + 30)
            context = content[ctx_start:ctx_end]

            if not _is_preserved_context(context):
                # Find approximate line number for the error message.
                line_no = content[:idx].count("\n") + 1
                errors.append(
                    f"Upstream brand string '{brand_string}' found at line {line_no} "
                    f"(not in a preserved context)"
                )

            start = idx + len(brand_string)

    return errors


def _is_preserved_context(context: str) -> bool:
    """Return True if the context indicates a legitimate preservation."""
    return any(pres in context for pres in _BRANDING_PRESERVATIONS)


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

    if ext in _JS_EXTENSIONS:
        return _check_js_brackets(content)
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
