"""Confidence scoring for branding conflict resolutions."""

from __future__ import annotations

from enum import Enum


class ConfidenceLevel(Enum):
    """Resolution confidence levels."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Thresholds for confidence classification.
_HIGH_THRESHOLD = 0.9
_MEDIUM_THRESHOLD = 0.6

# Base scores for LLM-reported confidence.
_LLM_SCORE = {
    "high": 0.95,
    "medium": 0.75,
    "low": 0.4,
}

# Penalty constants.
_VALIDATION_ERROR_PENALTY = 0.3
_MAX_VALIDATION_ERRORS = 3
_BRANDING_STRINGS_TIER1 = 5  # > this many -> -0.1
_BRANDING_STRINGS_TIER2 = 15  # > this many -> -0.15 more
_HUNK_THRESHOLD = 3
_HUNK_PENALTY = 0.05


def compute_confidence(
    llm_confidence: str,
    validation_errors: list[str],
    branding_strings_in_diff: int,
    hunk_count: int,
) -> ConfidenceLevel:
    """Compute an overall confidence level from multiple signals.

    Args:
        llm_confidence: The LLM's self-reported confidence ("high", "medium", "low").
        validation_errors: Errors found by the validator.
        branding_strings_in_diff: Number of branding-related strings in the diff.
        hunk_count: Number of diff hunks in the file.

    Returns:
        A ConfidenceLevel enum value.
    """
    score = _LLM_SCORE.get(llm_confidence.lower(), 0.4)

    # Penalise validation errors (up to MAX_VALIDATION_ERRORS counted).
    error_count = min(len(validation_errors), _MAX_VALIDATION_ERRORS)
    score -= error_count * _VALIDATION_ERROR_PENALTY

    # Penalise high branding-string density.
    if branding_strings_in_diff > _BRANDING_STRINGS_TIER2:
        score -= 0.25  # 0.1 + 0.15
    elif branding_strings_in_diff > _BRANDING_STRINGS_TIER1:
        score -= 0.1

    # Penalise many hunks (complex diffs).
    if hunk_count > _HUNK_THRESHOLD:
        score -= (hunk_count - _HUNK_THRESHOLD) * _HUNK_PENALTY

    # Clamp to [0.0, 1.0].
    score = max(0.0, min(1.0, score))

    if score >= _HIGH_THRESHOLD:
        return ConfidenceLevel.HIGH
    if score >= _MEDIUM_THRESHOLD:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW
