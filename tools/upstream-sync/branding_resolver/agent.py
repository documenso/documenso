"""OpenRouter/OpenAI SDK integration with tool-use for branding conflict resolution."""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING, Any, Literal

import openai
from pydantic import BaseModel, Field

from .confidence import ConfidenceLevel
from .exceptions import APIError

if TYPE_CHECKING:
    from .config import BrandingConfig
    from .differ import ConflictHunk, FileConflict
    from .rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# Retry configuration.
_MAX_RETRIES = 3
_BACKOFF_SECONDS = (5, 15, 60)

# ---------------------------------------------------------------------------
# Pydantic models for tool input schemas
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Auto-generated tool definitions from Pydantic models
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    openai.pydantic_function_tool(ResolveConflictInput, name="resolve_conflict"),
    openai.pydantic_function_tool(KeepOursInput, name="keep_ours"),
    openai.pydantic_function_tool(AcceptTheirsInput, name="accept_theirs"),
    openai.pydantic_function_tool(FlagForReviewInput, name="flag_for_review"),
]


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
        """Make the API call with retry logic.

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
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    tools=TOOL_DEFINITIONS,
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
