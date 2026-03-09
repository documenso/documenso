"""Exception hierarchy for the branding conflict resolver."""

from __future__ import annotations


class BrandingResolverError(Exception):
    """Base exception for all branding resolver errors."""


class APIError(BrandingResolverError):
    """Error communicating with an external API (e.g. Claude)."""


class RateLimitError(APIError):
    """API rate limit exceeded."""

    def __init__(self, retry_after: float, message: str = "Rate limit exceeded"):
        super().__init__(message)
        self.retry_after = retry_after


class DiffTooLargeError(BrandingResolverError):
    """A file's diff exceeds the maximum size for processing."""

    def __init__(self, file_path: str, size: int, max_size: int):
        super().__init__(
            f"Diff for '{file_path}' is {size:,} chars, exceeding limit of {max_size:,}"
        )
        self.file_path = file_path
        self.size = size
        self.max_size = max_size


class ValidationError(BrandingResolverError):
    """Validation failed on a resolved file."""

    def __init__(self, file_path: str, errors: list[str]):
        joined = "; ".join(errors)
        super().__init__(f"Validation failed for '{file_path}': {joined}")
        self.file_path = file_path
        self.errors = errors


class GitError(BrandingResolverError):
    """Error executing a git command."""
