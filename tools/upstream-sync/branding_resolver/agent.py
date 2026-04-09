"""Branding conflict resolution agent using tool-use via LLM providers.

The BrandingAgent builds prompts, sends them through an LLMClient (provider-
agnostic), and parses tool-call responses. Supports both single-turn batch
resolution and multi-turn agentic exploration.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

import openai
from pydantic import BaseModel, Field

from .confidence import ConfidenceLevel
from .model_client import ChatResponse, LLMClient, ToolCall
from .tool_executor import execute_tool_call

if TYPE_CHECKING:
    from .config import BrandingConfig
    from .differ import FileConflict

logger = logging.getLogger(__name__)

# Maximum exploration turns before the LLM must resolve.
_MAX_EXPLORATION_TURNS = 5

# ---------------------------------------------------------------------------
# Pydantic models for tool input schemas
# ---------------------------------------------------------------------------

# --- Resolution tools (terminate the conversation for a file) ---


class ResolveConflictInput(BaseModel):
    """Provide a fully merged version of the file that integrates upstream
    changes while preserving Davinci Sign branding.  Use this when you
    can intelligently combine both sides."""

    file_path: str = Field(description="The path to the conflicted file.")
    resolved_content: str = Field(description="The complete resolved file content.")
    explanation: str = Field(
        description="Brief explanation of what was merged and how branding was handled."
    )
    confidence: Literal["high", "medium", "low"] = Field(
        description="Your confidence that this resolution is correct."
    )


class KeepOursInput(BaseModel):
    """Keep our (Davinci Sign) version of the file entirely, discarding
    upstream changes.  Use when the file is purely branding."""

    file_path: str = Field(description="The path to the conflicted file.")
    explanation: str = Field(description="Why we should keep our version.")


class AcceptTheirsInput(BaseModel):
    """Accept the upstream (Documenso) version entirely.  Use when the
    file has no branding relevance and upstream changes should be taken."""

    file_path: str = Field(description="The path to the conflicted file.")
    explanation: str = Field(description="Why we should accept upstream's version.")


class FlagForReviewInput(BaseModel):
    """Flag a file for human review when automatic resolution is not safe."""

    file_path: str = Field(description="The path to the conflicted file.")
    reason: str = Field(description="Why this file needs human review.")
    suggested_resolution: str = Field(
        description="Your best-effort suggestion for how to resolve it."
    )
    ours_snippet: str = Field(description="Key snippet from our version.")
    theirs_snippet: str = Field(description="Key snippet from upstream version.")


# --- Exploration tools (continue the conversation) ---


class SearchCodebaseInput(BaseModel):
    """Search the codebase for symbol definitions, usages, or references.
    Use this when you need more context about a symbol, type, constant,
    or function referenced in a conflict.  Returns matching lines with
    file paths and line numbers."""

    pattern: str = Field(
        description=(
            "Search pattern (e.g., 'DOCUMENT_DISTRIBUTION_METHODS', "
            "'export const.*DistributionMethod', 'interface EnvelopeSettings'). "
            "Supports basic regex."
        )
    )
    file_glob: str = Field(
        default="",
        description=(
            "Optional glob to limit search scope "
            "(e.g., '*.ts', 'packages/lib/**'). Empty = search all files."
        ),
    )


class ReadFileInput(BaseModel):
    """Read the contents of a specific file from the codebase (our version).
    Use this when you found a relevant file via search_codebase and need
    to see more of it for context."""

    file_path: str = Field(
        description="Relative path to the file (e.g., 'packages/lib/constants/distribution.ts')"
    )
    start_line: int = Field(
        default=1,
        description="Starting line number (1-indexed). Default: 1.",
    )
    end_line: int = Field(
        default=100,
        description="Ending line number (inclusive). Default: 100. Max range: 200 lines.",
    )


# ---------------------------------------------------------------------------
# Auto-generated tool definitions from Pydantic models
# ---------------------------------------------------------------------------

RESOLUTION_TOOLS = [
    openai.pydantic_function_tool(ResolveConflictInput, name="resolve_conflict"),
    openai.pydantic_function_tool(KeepOursInput, name="keep_ours"),
    openai.pydantic_function_tool(AcceptTheirsInput, name="accept_theirs"),
    openai.pydantic_function_tool(FlagForReviewInput, name="flag_for_review"),
]

EXPLORATION_TOOLS = [
    openai.pydantic_function_tool(SearchCodebaseInput, name="search_codebase"),
    openai.pydantic_function_tool(ReadFileInput, name="read_file"),
]

# First-pass uses resolution tools only (fast, single call).
TOOL_DEFINITIONS = RESOLUTION_TOOLS

# Second-pass uses all tools (exploration + resolution).
ALL_TOOLS = EXPLORATION_TOOLS + RESOLUTION_TOOLS

EXPLORATION_TOOL_NAMES = {"search_codebase", "read_file"}
RESOLUTION_TOOL_NAMES = {"resolve_conflict", "keep_ours", "accept_theirs", "flag_for_review"}


class BrandingAgent:
    """Resolves branding conflicts via tool-use through an LLMClient."""

    def __init__(
        self,
        config: BrandingConfig,
        client: LLMClient,
        dry_run: bool = False,
    ) -> None:
        self.config = config
        self._client = client
        self.dry_run = dry_run
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost_usd: float = 0.0

    @property
    def model_name(self) -> str:
        return self._client.model_name

    # ------------------------------------------------------------------
    # System prompt
    # ------------------------------------------------------------------

    @staticmethod
    def build_system_prompt(config: BrandingConfig) -> str:
        """Build the system prompt encoding all branding rules."""
        substitution_lines = "\n".join(
            f"  - \"{pair[0]}\" -> \"{pair[1]}\""
            for pair in config.substitution_pairs
        )

        return f"""\
You are a branding-aware merge conflict resolver for "Davinci Sign", a fork of the
open-source Documenso e-signing platform.

## Brand Identity
- Product name: "Davinci Sign" (by "Davinci AI Solutions")
- Primary color: #1A98CF (Davinci Blue) — upstream uses #7AC455 (green)
- Email domain: @davincisolutions.ai
- Docker image: davinci/davinci-sign (not documenso/documenso)
- Support email: support@davincisolutions.ai

## Substitution Rules
When resolving conflicts, apply these brand substitutions:
{substitution_lines}

## Symbol Renames
- DOCUMENSO_INTERNAL_EMAIL -> DAVINCI_INTERNAL_EMAIL
- X-Documenso-Secret -> X-Davinci-Secret

## Critical Preservation Rules
1. NEVER change `@documenso/*` package scopes — these are internal and must remain.
2. NEVER remove upstream credit links (github.com/documenso, documenso.com/oss, etc.).
3. The Tailwind color KEY is named `documenso` internally — do NOT rename it.
   Only the color VALUES should be Davinci Blue (#1A98CF and its palette).
4. Keep HSL values: Primary 197 79% 46%, foreground 197 79% 10%.

## UI Customisations
These are intentional application-level branding changes in our fork:
- In the Email Sender dropdown (`meta.emailId`), the default/fallback option
  label is "Davinci Sign" (upstream uses "Documenso"). This appears as
  `<SelectItem value={{'-1'}}>Davinci Sign</SelectItem>` in the settings dialog.
- The `DOCUMENT_DISTRIBUTION_METHODS` constant and its usage are upstream
  functional code — do NOT replace with email sender options.

## Your Task
For each conflicted file, use exactly ONE of the provided tools:
- `resolve_conflict` — when you can intelligently merge both sides
- `keep_ours` — when the file is purely branding (our version is correct)
- `accept_theirs` — when the file has no branding and upstream changes are safe
- `flag_for_review` — when automatic resolution is unsafe or ambiguous

Call one tool per file.  Do NOT skip any file.

## Exploration Tools
Before resolving a file, you may use these tools to gather additional context:
- `search_codebase` — Search for symbol definitions, type declarations, or usages
- `read_file` — Read a specific file to understand types, interfaces, or constants

Use these when a conflict references symbols, types, or constants you don't have
enough context to resolve confidently.  You have up to 5 exploration calls before
you must resolve.  When you have enough context, call one of the resolution tools.

## Quality Standards
- The resolved file must compile / parse correctly (no syntax errors).
- No leftover merge conflict markers (<<<<<<, =======, >>>>>>>).
- Preserve upstream functional changes while applying branding.
- When in doubt, flag for review rather than guessing.
"""

    # ------------------------------------------------------------------
    # Main resolution method
    # ------------------------------------------------------------------

    def resolve_files(self, files: list[FileConflict]) -> list[dict[str, Any]]:
        """Resolve a batch of file conflicts via the LLM client.

        Uses resolution-only tools (no exploration). Good for fast first-pass.
        """
        if not files:
            return []

        user_message = self._build_user_message(files)
        system_prompt = self.build_system_prompt(self.config)

        response = self._client.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            tools=TOOL_DEFINITIONS,
            tool_choice="required",
        )

        self.total_input_tokens += response.input_tokens
        self.total_output_tokens += response.output_tokens
        self.total_cost_usd += response.cost_usd

        results = self._parse_tool_calls(response)

        # Safety: flag any files the LLM missed.
        resolved_paths = {r["file_path"] for r in results}
        for f in files:
            if f.path not in resolved_paths:
                logger.warning("LLM missed file %s — flagging for review", f.path)
                results.append({
                    "tool": "flag_for_review",
                    "file_path": f.path,
                    "reason": "LLM did not return a resolution for this file.",
                    "suggested_resolution": "",
                    "ours_snippet": "",
                    "theirs_snippet": "",
                })

        return results

    # ------------------------------------------------------------------
    # Resolution with exploration tools (multi-turn)
    # ------------------------------------------------------------------

    def resolve_files_with_exploration(
        self,
        files: list[FileConflict],
        repo_path: Path,
    ) -> list[dict[str, Any]]:
        """Resolve files with agentic codebase exploration.

        The LLM can call ``search_codebase`` and ``read_file`` to gather
        context before calling a resolution tool. Caps at
        ``_MAX_EXPLORATION_TURNS`` to prevent runaway costs.
        """
        if not files:
            return []

        user_message = self._build_user_message(files)
        system_prompt = self.build_system_prompt(self.config)
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        resolution_results: list[dict[str, Any]] = []
        resolved_paths: set[str] = set()

        for turn in range(_MAX_EXPLORATION_TURNS):
            response = self._client.chat(
                messages=messages,
                tools=ALL_TOOLS,
                tool_choice="required",
            )

            self.total_input_tokens += response.input_tokens
            self.total_output_tokens += response.output_tokens

            if not response.message.tool_calls:
                break

            # Build assistant message for conversation history.
            assistant_tool_calls: list[dict[str, Any]] = []
            tool_responses: list[dict[str, str]] = []
            has_exploration = False

            for tc in response.message.tool_calls:
                # Build OpenAI-format tool_call for message history.
                assistant_tool_calls.append({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments),
                    },
                })

                if tc.name in EXPLORATION_TOOL_NAMES:
                    has_exploration = True
                    result_text = execute_tool_call(tc.name, tc.arguments, repo_path)
                    tool_responses.append({
                        "tool_call_id": tc.id,
                        "content": result_text,
                    })
                    log_key = tc.arguments.get("pattern", tc.arguments.get("file_path", ""))
                    logger.info(
                        "Exploration [turn %d]: %s(%s) → %d chars",
                        turn + 1, tc.name, log_key, len(result_text),
                    )
                else:
                    # Resolution tool — collect and acknowledge.
                    resolution_results.append({"tool": tc.name, **tc.arguments})
                    resolved_paths.add(tc.arguments.get("file_path", ""))
                    tool_responses.append({
                        "tool_call_id": tc.id,
                        "content": "Resolution recorded.",
                    })

            # If all files resolved, we're done.
            if len(resolved_paths) >= len(files):
                break

            # If no exploration tools were called this turn, stop looping.
            if not has_exploration:
                break

            # Append assistant message + tool results for next turn.
            messages.append({
                "role": "assistant",
                "tool_calls": assistant_tool_calls,
                "content": response.message.text or "",
            })
            for tr in tool_responses:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tr["tool_call_id"],
                    "content": tr["content"],
                })

        # Safety: flag any files the LLM missed.
        for f in files:
            if f.path not in resolved_paths:
                logger.warning(
                    "LLM did not resolve %s within %d exploration turns — flagging",
                    f.path, _MAX_EXPLORATION_TURNS,
                )
                resolution_results.append({
                    "tool": "flag_for_review",
                    "file_path": f.path,
                    "reason": (
                        "LLM did not resolve this file within the exploration "
                        f"limit ({_MAX_EXPLORATION_TURNS} turns)."
                    ),
                    "suggested_resolution": "",
                    "ours_snippet": "",
                    "theirs_snippet": "",
                })

        return resolution_results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_user_message(self, files: list[FileConflict]) -> str:
        """Build the user message content from file conflicts."""
        parts: list[str] = []
        parts.append(
            f"Please resolve the following {len(files)} conflicted file(s).\n"
            f"For each file, call exactly ONE tool.\n"
        )

        for f in files:
            parts.append(f"---\n### File: `{f.path}`\n")

            if f.hunks:
                parts.append(f"**Diff hunks ({len(f.hunks)}):**\n```diff")
                for hunk in f.hunks:
                    parts.append(
                        f"--- ours (lines {hunk.start_line}-{hunk.end_line})\n"
                        f"{hunk.context_before}"
                        f"<<<<<<< ours\n{hunk.ours}=======\n{hunk.theirs}"
                        f">>>>>>> theirs\n"
                        f"{hunk.context_after}"
                    )
                parts.append("```\n")

            if f.full_ours is not None:
                ours_preview = _truncate(f.full_ours, 6000)
                parts.append(f"**Our version (Davinci Sign):**\n```\n{ours_preview}\n```\n")

            if f.full_theirs is not None:
                theirs_preview = _truncate(f.full_theirs, 6000)
                parts.append(f"**Upstream version (Documenso):**\n```\n{theirs_preview}\n```\n")

        return "\n".join(parts)

    @staticmethod
    def _parse_tool_calls(response: ChatResponse) -> list[dict[str, Any]]:
        """Extract tool calls from a normalised ChatResponse."""
        results: list[dict[str, Any]] = []

        for tc in response.message.tool_calls:
            result: dict[str, Any] = {"tool": tc.name, **tc.arguments}
            results.append(result)

        return results


    # ------------------------------------------------------------------
    # Hunk-based resolution (fallback for truncated files)
    # ------------------------------------------------------------------

    def resolve_hunks(self, file_conflict: FileConflict) -> list[str] | None:
        """Resolve each conflict hunk individually, returning replacement text per hunk.

        This is a cheap fallback for files where full-file resolution gets
        truncated. Each hunk is resolved in isolation with minimal tokens.

        Returns a list of resolved strings (one per hunk), or None on failure.
        """
        if not file_conflict.hunks:
            return None

        system_prompt = self.build_system_prompt(self.config)
        resolved_hunks: list[str] = []

        for i, hunk in enumerate(file_conflict.hunks):
            user_message = (
                f"Resolve this ONE conflict hunk from `{file_conflict.path}` "
                f"(hunk {i + 1} of {len(file_conflict.hunks)}).\n\n"
                f"**Context before:**\n```\n{hunk.context_before}\n```\n\n"
                f"**Our version (Davinci Sign):**\n```\n{hunk.ours}\n```\n\n"
                f"**Upstream version (Documenso):**\n```\n{hunk.theirs}\n```\n\n"
                f"**Context after:**\n```\n{hunk.context_after}\n```\n\n"
                f"Return ONLY the replacement text for this hunk using the `resolve_hunk` tool. "
                f"Apply branding substitutions. Do NOT include the context before/after — "
                f"just the lines that replace the conflict region."
            )

            hunk_tool: dict[str, Any] = {
                "type": "function",
                "function": {
                    "name": "resolve_hunk",
                    "description": "Return the resolved replacement text for a single conflict hunk.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "resolved_text": {
                                "type": "string",
                                "description": "The replacement text for this hunk (no conflict markers, no surrounding context).",
                            },
                            "explanation": {
                                "type": "string",
                                "description": "Brief explanation of the resolution.",
                            },
                        },
                        "required": ["resolved_text", "explanation"],
                    },
                },
            }

            try:
                response = self._client.chat(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    tools=[hunk_tool],
                    tool_choice="required",
                    max_tokens=4096,
                )

                self.total_input_tokens += response.input_tokens
                self.total_output_tokens += response.output_tokens
                self.total_cost_usd += response.cost_usd

                for tc in response.message.tool_calls:
                    if tc.name == "resolve_hunk":
                        resolved_hunks.append(tc.arguments.get("resolved_text", ""))
                        break
                else:
                    logger.warning("Hunk %d/%d: no resolve_hunk call returned", i + 1, len(file_conflict.hunks))
                    return None

            except Exception:
                logger.exception("Hunk %d/%d resolution failed for %s", i + 1, len(file_conflict.hunks), file_conflict.path)
                return None

        logger.info(
            "Hunk-based: resolved %d/%d hunks for %s",
            len(resolved_hunks), len(file_conflict.hunks), file_conflict.path,
        )

        return resolved_hunks


def _truncate(text: str, max_chars: int) -> str:
    """Truncate text to max_chars with a notice."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n... (truncated, {len(text)} chars total)"
