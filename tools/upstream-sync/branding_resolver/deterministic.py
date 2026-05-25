"""Deterministic branding substitution pass.

Applies the BRANDING_SUBSTITUTIONS rules from config.py to file content,
skipping occurrences that fall inside any preservation string (e.g.
``@documenso/`` package scopes, ``github.com/documenso/...`` credit links).

Runs after the LLM has produced a structurally-merged file but before
validation, so any literal upstream brand string the LLM missed is fixed
without another round-trip. Pure regex/string work — no I/O, no LLM.
"""

from __future__ import annotations

from .config import BRANDING_PRESERVATIONS, BRANDING_SUBSTITUTIONS


def _preserved_ranges(content: str, preservations: list[str]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for pres in preservations:
        start = 0
        while True:
            idx = content.find(pres, start)
            if idx == -1:
                break
            ranges.append((idx, idx + len(pres)))
            start = idx + len(pres)
    return ranges


def _is_inside(start: int, end: int, ranges: list[tuple[int, int]]) -> bool:
    return any(rs <= start and end <= re_ for rs, re_ in ranges)


def apply_substitutions(
    content: str,
    substitutions: list[tuple[str, str]] | None = None,
    preservations: list[str] | None = None,
) -> str:
    """Apply branding substitutions in order, skipping preserved contexts.

    The substitution list is processed in its given order (BRANDING_SUBSTITUTIONS
    is ordered longest-first, so ``"Documenso, Inc."`` runs before ``"Documenso"``).
    For each occurrence of ``src``, the replacement is skipped if the match sits
    inside any preservation string (e.g. ``github.com/documenso/documenso``).

    Preservation ranges are recomputed before every substitution because earlier
    substitutions can change content offsets.
    """
    if substitutions is None:
        substitutions = BRANDING_SUBSTITUTIONS
    if preservations is None:
        preservations = BRANDING_PRESERVATIONS

    for src, dst in substitutions:
        if not src:
            continue
        ranges = _preserved_ranges(content, preservations)
        out: list[str] = []
        cursor = 0
        while True:
            idx = content.find(src, cursor)
            if idx == -1:
                out.append(content[cursor:])
                break
            end = idx + len(src)
            out.append(content[cursor:idx])
            if _is_inside(idx, end, ranges):
                out.append(content[idx:end])
            else:
                out.append(dst)
            cursor = end
        content = "".join(out)
    return content
