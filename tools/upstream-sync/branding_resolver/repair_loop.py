"""Self-healing validation loop for resolved file content.

After each file resolution, this module validates the result and attempts
automated repair through multiple rounds:

  Round 0: Validate (existing validator). If pass → done.
  Round 1: Run auto-formatters (prettier, yaml). Re-validate. If pass → done.
  Round 2: Feed errors + content back to the LLM for a fix. Re-validate.
  Round 3: One more LLM fix attempt with explicit error context.
  Still failing → mark as needing model escalation.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field

from .validator import auto_format_file, validate_resolved_file

if TYPE_CHECKING:
    from .config import BrandingConfig
    from .model_client import LLMClient

logger = logging.getLogger(__name__)

# Maximum LLM fix rounds (rounds 2 and 3).
_MAX_LLM_FIX_ROUNDS = 2


class RepairResult(BaseModel):
    """Result of the repair loop for a single file."""

    success: bool = Field(description="Whether the file passed validation.")
    content: str = Field(description="The final file content (repaired or original).")
    errors: list[str] = Field(
        default_factory=list,
        description="Remaining validation errors (empty if success).",
    )
    round_succeeded: int | None = Field(
        default=None,
        description="Which round fixed it: 0=first-pass, 1=formatter, 2=llm-fix-1, 3=llm-fix-2. None if failed.",
    )
    model_used: str = Field(
        default="",
        description="Model name used for any LLM fix rounds.",
    )
    total_repair_calls: int = Field(
        default=0,
        description="Number of LLM repair API calls made.",
    )
    cost_usd: float = Field(
        default=0.0,
        description="Total USD cost of repair LLM calls.",
    )


def repair_file(
    file_path: str,
    content: str,
    config: BrandingConfig,
    repo_path: Path,
    llm_client: LLMClient | None = None,
    max_rounds: int = 3,
) -> RepairResult:
    """Run the self-healing validation loop on a resolved file.

    Args:
        file_path: Relative path to the file.
        content: The resolved file content from the LLM.
        config: Branding configuration for validation rules.
        repo_path: Path to the repository root.
        llm_client: Optional LLM client for fix rounds 2-3. If None,
            only rounds 0-1 (validate + auto-format) are attempted.
        max_rounds: Maximum repair rounds (0-3). Default 3.

    Returns:
        A RepairResult with the final state.
    """
    model_name = llm_client.model_name if llm_client else ""
    repair_calls = 0
    total_cost = 0.0

    # Round 0: Validate as-is.
    errors = validate_resolved_file(file_path, content, config)
    if not errors:
        logger.info("Round 0 pass for %s — no errors", file_path)
        return RepairResult(
            success=True,
            content=content,
            round_succeeded=0,
            model_used=model_name,
        )

    logger.info(
        "Round 0 failed for %s with %d error(s): %s",
        file_path, len(errors), "; ".join(errors[:3]),
    )

    if max_rounds < 1:
        return RepairResult(
            success=False, content=content, errors=errors,
            model_used=model_name, total_repair_calls=repair_calls,
        )

    # Round 1: Auto-format and re-validate.
    formatted = auto_format_file(file_path, content, repo_path)
    if formatted != content:
        errors = validate_resolved_file(file_path, formatted, config)
        if not errors:
            logger.info("Round 1 pass for %s — formatter fixed it", file_path)
            return RepairResult(
                success=True,
                content=formatted,
                round_succeeded=1,
                model_used=model_name,
            )
        logger.info(
            "Round 1 (formatter) still has %d error(s) for %s",
            len(errors), file_path,
        )
        content = formatted  # Use formatted version as base for LLM fix
    else:
        logger.debug("Round 1 skipped for %s — formatter made no changes", file_path)

    if max_rounds < 2 or llm_client is None:
        return RepairResult(
            success=False, content=content, errors=errors,
            model_used=model_name, total_repair_calls=repair_calls,
            cost_usd=total_cost,
        )

    # Rounds 2-3: LLM fix attempts.
    for round_num in range(2, min(max_rounds + 1, 2 + _MAX_LLM_FIX_ROUNDS)):
        logger.info(
            "Round %d for %s — sending %d error(s) to LLM for fix",
            round_num, file_path, len(errors),
        )

        fixed, call_cost = _llm_fix(
            file_path=file_path,
            content=content,
            errors=errors,
            config=config,
            llm_client=llm_client,
            round_num=round_num,
        )
        repair_calls += 1
        total_cost += call_cost

        if fixed is None:
            logger.warning("Round %d LLM fix returned nothing for %s", round_num, file_path)
            continue

        errors = validate_resolved_file(file_path, fixed, config)
        if not errors:
            logger.info("Round %d pass for %s — LLM fixed it", round_num, file_path)
            return RepairResult(
                success=True,
                content=fixed,
                round_succeeded=round_num,
                model_used=model_name,
                total_repair_calls=repair_calls,
                cost_usd=total_cost,
            )

        logger.info(
            "Round %d still has %d error(s) for %s",
            round_num, len(errors), file_path,
        )
        content = fixed  # Use LLM output as base for next round

    # All rounds exhausted.
    return RepairResult(
        success=False,
        content=content,
        errors=errors,
        model_used=model_name,
        total_repair_calls=repair_calls,
        cost_usd=total_cost,
    )


def _llm_fix(
    file_path: str,
    content: str,
    errors: list[str],
    config: BrandingConfig,
    llm_client: LLMClient,
    round_num: int,
) -> tuple[str | None, float]:
    """Ask the LLM to fix validation errors in a resolved file.

    Returns (fixed_content, cost_usd). fixed_content is None if the LLM fails.
    """
    from .agent import BrandingAgent  # noqa: PLC0415 — avoid circular import

    error_list = "\n".join(f"  - {e}" for e in errors)

    system_prompt = BrandingAgent.build_system_prompt(config)

    fix_prompt = f"""\
The following file was resolved from a merge conflict but has validation errors.
Please fix ALL the errors and return the corrected complete file content.

## File: `{file_path}`

## Validation Errors (round {round_num})
{error_list}

## Current File Content
```
{content}
```

## Instructions
- Fix every validation error listed above
- Do NOT introduce new issues
- Return the COMPLETE file content via the `fix_file` tool
- Preserve all branding (Davinci Sign) and functional changes
- Ensure brackets, braces, and parentheses are balanced
- Remove any upstream brand strings that should have been replaced
- Do NOT leave any merge conflict markers
"""

    # Define a simple fix tool.
    fix_tool: dict[str, Any] = {
        "type": "function",
        "function": {
            "name": "fix_file",
            "description": "Return the complete fixed file content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The path to the file being fixed.",
                    },
                    "fixed_content": {
                        "type": "string",
                        "description": "The complete fixed file content.",
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Brief explanation of what was fixed.",
                    },
                },
                "required": ["file_path", "fixed_content", "explanation"],
            },
        },
    }

    try:
        response = llm_client.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": fix_prompt},
            ],
            tools=[fix_tool],
            tool_choice="required",
            max_tokens=16384,
        )

        cost = response.cost_usd

        for tc in response.message.tool_calls:
            if tc.name == "fix_file":
                fixed_content = tc.arguments.get("fixed_content", "")
                explanation = tc.arguments.get("explanation", "")
                if fixed_content:
                    logger.info(
                        "LLM fix for %s (round %d): %s",
                        file_path, round_num, explanation[:100],
                    )
                    return fixed_content, cost

        logger.warning("LLM did not return fix_file tool call for %s", file_path)
        return None, cost

    except Exception:
        logger.exception("LLM fix failed for %s (round %d)", file_path, round_num)
        return None, 0.0
