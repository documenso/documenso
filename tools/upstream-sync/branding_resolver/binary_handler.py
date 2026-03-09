"""Handler for binary file conflicts during upstream merges."""

from __future__ import annotations

from .classifier import FileCategory, classify_file, is_binary_file
from .config import BrandingConfig


def resolve_binary_file(file_path: str, config: BrandingConfig) -> dict:
    """Resolve a binary file conflict based on its classification.

    Returns a dict with:
        - action: "keep_ours" | "accept_theirs" | "flag"
        - explanation: human-readable reason for the decision
    """
    if not is_binary_file(file_path, config):
        return {
            "action": "flag",
            "explanation": f"Not a binary file: {file_path}",
        }

    category = classify_file(file_path, config)

    if category == FileCategory.A_PURE_BRANDING:
        return {
            "action": "keep_ours",
            "explanation": (
                f"Binary branding asset '{file_path}' — keeping our Davinci Sign version."
            ),
        }

    if category == FileCategory.C_PURE_FUNCTIONAL:
        return {
            "action": "accept_theirs",
            "explanation": (
                f"Binary functional file '{file_path}' — accepting upstream version."
            ),
        }

    return {
        "action": "flag",
        "explanation": (
            f"Binary file '{file_path}' could not be auto-classified "
            f"(category={category.value}). Manual review required."
        ),
    }
