"""OpenRouter/OpenAI SDK integration with tool-use for branding conflict resolution."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

import openai
from pydantic import BaseModel, Field

from .confidence import ConfidenceLevel
from .exceptions import APIError
from .tool_executor import execute_tool_call

if TYPE_CHECKING:
    from .config import BrandingConfig
    from .differ import ConflictHunk, FileConflict
    from .rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# Retry configuration.
_MAX_RETRIES = 3
_BACKOFF_SECONDS = (5, 15, 60)

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
    """OpenRouter API client that resolves branding conflicts via tool-use."""

    def __init__(
        self,
        config: BrandingConfig,
        api_key: str | None = None,
        model: str = "google/gemini-3-flash-preview",
        dry_run: bool = False,
    ) -> None:
        self.config = config
        self.model = model
        self.dry_run = dry_run
        self.total_input_tokens = 0
        self.total_output_tokens = 0

        # Lazy-import to keep module importable without rate_limiter existing.
        from .rate_limiter import RateLimiter  # noqa: PLC0415

        self._rate_limiter = RateLimiter()

        self._client = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key or "",
        )

    # ------------------------------------------------------------------
    # System prompt
    # ------------------------------------------------------------------

    @staticmethod
    def build_system_prompt(config: BrandingConfig) -> str:
        """Build the system prompt encoding all branding rules.

        Args:
            config: The branding configuration with substitution pairs.

        Returns:
            A system prompt string.
        """
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
        """Resolve a batch of file conflicts via the OpenRouter API.

        Args:
            files: List of FileConflict objects to resolve.

        Returns:
            A list of dicts with resolution details, one per file.

        Raises:
            APIError: If the API is unreachable after all retries.
        """
        if not files:
            return []

        user_message = self._build_user_message(files)
        system_prompt = self.build_system_prompt(self.config)

        response = self._call_api(system_prompt, user_message)

        # Parse tool_use blocks from the response.
        results = self._parse_tool_calls(response)

        # Safety: flag any files the LLM missed.
        resolved_paths = {r["file_path"] for r in results}
        for f in files:
            if f.path not in resolved_paths:
                logger.warning("LLM missed file %s — flagging for review", f.path)
                results.append(
                    {
                        "tool": "flag_for_review",
                        "file_path": f.path,
                        "reason": "LLM did not return a resolution for this file.",
                        "suggested_resolution": "",
                        "ours_snippet": "",
                        "theirs_snippet": "",
                    }
                )

        return results

    # ------------------------------------------------------------------
    # Second-pass resolution with exploration tools
    # ------------------------------------------------------------------

    def resolve_files_with_exploration(
        self,
        files: list[FileConflict],
        repo_path: Path,
    ) -> list[dict[str, Any]]:
        """Resolve files with agentic codebase exploration.

        The LLM can call ``search_codebase`` and ``read_file`` to gather
        context before calling a resolution tool.  The loop caps at
        ``_MAX_EXPLORATION_TURNS`` to prevent runaway costs.

        Args:
            files: File conflicts to resolve (usually a single file).
            repo_path: Path to the git repository root.

        Returns:
            Resolution dicts, one per file, in the same format as
            ``resolve_files()``.
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
            response = self._call_api_with_messages(messages, ALL_TOOLS)

            message = response.choices[0].message
            if not message.tool_calls:
                break

            # Process each tool call in this turn.
            tool_responses: list[dict[str, str]] = []
            has_exploration = False

            for tool_call in message.tool_calls:
                name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                if name in EXPLORATION_TOOL_NAMES:
                    has_exploration = True
                    result_text = execute_tool_call(name, args, repo_path)
                    tool_responses.append({
                        "tool_call_id": tool_call.id,
                        "content": result_text,
                    })
                    log_key = args.get("pattern", args.get("file_path", ""))
                    logger.info(
                        "Exploration [turn %d]: %s(%s) → %d chars",
                        turn + 1, name, log_key, len(result_text),
                    )
                else:
                    # Resolution tool — collect and acknowledge.
                    resolution_results.append({"tool": name, **args})
                    resolved_paths.add(args.get("file_path", ""))
                    tool_responses.append({
                        "tool_call_id": tool_call.id,
                        "content": "Resolution recorded.",
                    })

            # If all files resolved, we're done.
            if len(resolved_paths) >= len(files):
                break

            # If no exploration tools were called this turn, stop looping.
            if not has_exploration:
                break

            # Append assistant message + tool results for next turn.
            messages.append({"role": "assistant", "tool_calls": message.tool_calls})
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

    def _call_api(self, system_prompt: str, user_message: str) -> Any:
        """Make a single-turn API call (system + user → response).

        Delegates to ``_call_api_with_messages`` with resolution-only tools.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        return self._call_api_with_messages(messages, TOOL_DEFINITIONS)

    def _call_api_with_messages(
        self,
        messages: list[dict[str, Any]],
        tools: list[Any],
    ) -> Any:
        """Make an API call with a full message history and retry logic.

        Retries on rate-limit (429) and server errors (5xx) with exponential
        backoff.  Raises APIError after exhausting all retries.
        """
        last_error: Exception | None = None

        for attempt in range(_MAX_RETRIES):
            try:
                self._rate_limiter.wait()

                response = self._client.chat.completions.create(
                    model=self.model,
                    max_tokens=16384,
                    messages=messages,
                    tools=tools,
                    tool_choice="required",
                )

                # Track token usage.
                if response.usage:
                    self.total_input_tokens += response.usage.prompt_tokens
                    self.total_output_tokens += response.usage.completion_tokens

                return response

            except openai.RateLimitError as exc:
                last_error = exc
                backoff = _BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)]
                logger.warning(
                    "Rate limited (attempt %d/%d), backing off %ds",
                    attempt + 1,
                    _MAX_RETRIES,
                    backoff,
                )
                time.sleep(backoff)

            except openai.APIStatusError as exc:
                if exc.status_code >= 500:
                    last_error = exc
                    backoff = _BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)]
                    logger.warning(
                        "Server error %d (attempt %d/%d), backing off %ds",
                        exc.status_code,
                        attempt + 1,
                        _MAX_RETRIES,
                        backoff,
                    )
                    time.sleep(backoff)
                else:
                    raise

            except openai.APIConnectionError as exc:
                last_error = exc
                backoff = _BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)]
                logger.warning(
                    "Connection error (attempt %d/%d), backing off %ds",
                    attempt + 1,
                    _MAX_RETRIES,
                    backoff,
                )
                time.sleep(backoff)

        raise APIError(
            f"OpenRouter API unreachable after {_MAX_RETRIES} retries: {last_error}"
        ) from last_error

    @staticmethod
    def _parse_tool_calls(response: Any) -> list[dict[str, Any]]:
        """Extract tool calls from the OpenAI-format API response."""
        results: list[dict[str, Any]] = []

        message = response.choices[0].message
        if not message.tool_calls:
            return results

        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            inputs = json.loads(tool_call.function.arguments)

            result: dict[str, Any] = {"tool": tool_name, **inputs}
            results.append(result)

        return results


def _truncate(text: str, max_chars: int) -> str:
    """Truncate text to max_chars with a notice."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n... (truncated, {len(text)} chars total)"
