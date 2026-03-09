"""File classification for branding conflict resolution."""

from __future__ import annotations

import os
from enum import Enum
from fnmatch import fnmatch

from .config import BRANDING_SUBSTITUTIONS, BrandingConfig


class FileCategory(Enum):
    """Classification of a file's relationship to branding."""

    A_PURE_BRANDING = "pure_branding"
    B_MIXED = "mixed"
    C_PURE_FUNCTIONAL = "pure_functional"
    D_AMBIGUOUS = "ambiguous"


def is_binary_file(file_path: str, config: BrandingConfig) -> bool:
    """Check if a file is binary based on its extension."""
    _, ext = os.path.splitext(file_path)
    return ext.lower() in config.binary_extensions


def _is_in_asset_dir(file_path: str) -> bool:
    """Check if a file is in a known asset directory."""
    asset_dirs = (
        "packages/assets/",
        "apps/remix/public/",
        "apps/documentation/public/",
        "packages/email/static/",
    )
    return any(file_path.startswith(d) for d in asset_dirs)


def classify_file(
    file_path: str,
    config: BrandingConfig,
    diff_content: str | None = None,
) -> FileCategory:
    """Classify a file into a branding category.

    Priority:
    1. Exact path match for pure_branding_paths -> A_PURE_BRANDING
    2. Binary file in known asset dirs -> A_PURE_BRANDING
    3. Exact path match for mixed_branding_paths -> B_MIXED
    4. Diff content contains upstream branding strings -> B_MIXED (promoted)
    5. Matches pure_functional_patterns -> C_PURE_FUNCTIONAL
    6. Default -> D_AMBIGUOUS
    """
    # 1. Exact match on pure branding paths
    if file_path in config.pure_branding_paths:
        return FileCategory.A_PURE_BRANDING

    # 2. Binary file in asset directory
    if is_binary_file(file_path, config) and _is_in_asset_dir(file_path):
        return FileCategory.A_PURE_BRANDING

    # 3. Exact match on mixed branding paths
    if file_path in config.mixed_branding_paths:
        return FileCategory.B_MIXED

    # 4. Diff content contains upstream branding strings -> promote to mixed
    if diff_content:
        for old, _new in BRANDING_SUBSTITUTIONS:
            if old in diff_content:
                return FileCategory.B_MIXED

    # 5. Matches pure functional patterns
    for pattern in config.pure_functional_patterns:
        if fnmatch(file_path, pattern):
            return FileCategory.C_PURE_FUNCTIONAL

    # 6. Default
    return FileCategory.D_AMBIGUOUS
