"""Top-level orchestrator for branding-aware merge conflict resolution."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field

from .agent import BrandingAgent
from .classifier import FileCategory, classify_file
from .confidence import ConfidenceLevel, compute_confidence
from .differ import FileConflict, build_file_conflict, chunk_file_diffs
from .validator import validate_resolved_file

if TYPE_CHECKING:
    from .config import BrandingConfig

logger = logging.getLogger(__name__)


class Resolution(BaseModel):
    """A single file resolution."""

    file_path: str = Field(description="Relative path of the resolved file.")
    category: str = Field(description="Classification: A, B, C, D, or special.")
    action: str = Field(
        description="Resolution action: keep_ours, accept_theirs, resolve_conflict, or flag_for_review."
    )
    content: str | None = Field(
        default=None,
        description="Resolved content (None for keep_ours / accept_theirs).",
    )
    explanation: str = Field(default="", description="Human-readable explanation.")
    confidence: ConfidenceLevel = Field(
        default=ConfidenceLevel.HIGH, description="Confidence level of the resolution."
    )
    validation_errors: list[str] = Field(
        default_factory=list, description="Validation errors found in the resolution."
    )


class MergeResult(BaseModel):
    """Summary of the full merge resolution."""

    model_config = ConfigDict(frozen=True)

    resolutions: list[Resolution] = Field(description="Per-file resolution details.")
    total_files: int = Field(description="Total number of conflicted files.")
    auto_resolved: int = Field(description="Files resolved automatically.")
    flagged_for_review: int = Field(description="Files flagged for human review.")
    api_calls_made: int = Field(description="Number of LLM API calls made.")
    total_input_tokens: int = Field(description="Total input tokens consumed.")
    total_output_tokens: int = Field(description="Total output tokens consumed.")


# Map FileCategory enum values to short string labels.
_CATEGORY_LABELS = {
    FileCategory.A_PURE_BRANDING: "A",
    FileCategory.B_MIXED: "B",
    FileCategory.C_PURE_FUNCTIONAL: "C",
    FileCategory.D_AMBIGUOUS: "D",
}


class BrandingResolver:
    """Orchestrates branding-aware merge conflict resolution.

    Classifies conflicted files, resolves trivial ones locally, and sends
    complex ones to the BrandingAgent (Claude API) for intelligent merging.
    """

    def __init__(
        self,
        repo_path: str | Path,
        config: BrandingConfig | None = None,
        api_key: str | None = None,
        model: str = "google/gemini-3-flash-preview",
        dry_run: bool = False,
    ) -> None:
        self.repo_path = Path(repo_path)
        self.dry_run = dry_run

        if config is None:
            from .config import BrandingConfig as _BrandingConfig  # noqa: PLC0415

            config = _BrandingConfig()
        self.config = config

        self._agent = BrandingAgent(
            config=self.config,
            api_key=api_key,
            model=model,
            dry_run=dry_run,
        )
        self._api_calls = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resolve_merge(
        self,
        our_branch: str = "origin/main",
        upstream_branch: str = "upstream/main",
    ) -> MergeResult:
        """Resolve all merge conflicts between our branch and upstream.

        Expects that ``git merge`` has already been started and conflicts exist.

        Args:
            our_branch: Our branch name (for logging).
            upstream_branch: Upstream branch/tag name (for logging).

        Returns:
            A MergeResult with statistics and per-file resolutions.
        """
        conflicted_files = self._get_conflicted_files()
        logger.info(
            "Found %d conflicted files between %s and %s",
            len(conflicted_files),
            our_branch,
            upstream_branch,
        )

        resolutions: list[Resolution] = []
        llm_files: list[FileConflict] = []
        llm_categories: dict[str, str] = {}  # path -> category label

        for file_path in conflicted_files:
            # Special case: package-lock.json
            if Path(file_path).name == "package-lock.json":
                res = self._handle_package_lock(file_path)
                resolutions.append(res)
                continue

            # Classify the file.
            category = classify_file(file_path, self.config)
            cat_label = _CATEGORY_LABELS.get(category, "D")

            if category == FileCategory.A_PURE_BRANDING:
                self._checkout_ours(file_path)
                resolutions.append(
                    Resolution(
                        file_path=file_path,
                        category=cat_label,
                        action="keep_ours",
                        explanation="Pure branding file — kept our Davinci Sign version.",
                        confidence=ConfidenceLevel.HIGH,
                    )
                )

            elif category == FileCategory.C_PURE_FUNCTIONAL:
                self._checkout_theirs(file_path)
                resolutions.append(
                    Resolution(
                        file_path=file_path,
                        category=cat_label,
                        action="accept_theirs",
                        explanation="No branding relevance — accepted upstream changes.",
                        confidence=ConfidenceLevel.HIGH,
                    )
                )

            else:
                # Category B or D — needs LLM resolution.
                conflict = build_file_conflict(file_path, self.repo_path)
                llm_files.append(conflict)
                llm_categories[file_path] = cat_label

        # Process LLM files in chunks.
        if llm_files:
            chunks = chunk_file_diffs(llm_files)
            logger.info(
                "Sending %d files to LLM in %d chunk(s)",
                len(llm_files),
                len(chunks),
            )

            for chunk in chunks:
                self._api_calls += 1
                llm_results = self._agent.resolve_files(chunk)

                for result in llm_results:
                    res = self._process_llm_result(result, llm_files, llm_categories)
                    resolutions.append(res)

        # Compute summary statistics.
        flagged = sum(
            1
            for r in resolutions
            if r.action == "flag_for_review" or r.confidence == ConfidenceLevel.LOW
        )
        auto_resolved = len(resolutions) - flagged

        return MergeResult(
            resolutions=resolutions,
            total_files=len(conflicted_files),
            auto_resolved=auto_resolved,
            flagged_for_review=flagged,
            api_calls_made=self._api_calls,
            total_input_tokens=self._agent.total_input_tokens,
            total_output_tokens=self._agent.total_output_tokens,
        )

    # ------------------------------------------------------------------
    # LLM result processing
    # ------------------------------------------------------------------

    def _process_llm_result(
        self,
        result: dict[str, Any],
        llm_files: list[FileConflict],
        llm_categories: dict[str, str],
    ) -> Resolution:
        """Convert an LLM tool-call result into a Resolution."""
        tool = result["tool"]
        file_path = result["file_path"]
        category = llm_categories.get(file_path, "B")

        if tool == "resolve_conflict":
            content = result["resolved_content"]
            explanation = result["explanation"]
            llm_confidence = result.get("confidence", "medium")

            # Validate the resolved content.
            validation_errors = validate_resolved_file(
                file_path, content, self.config
            )

            # Count branding strings in the content for confidence scoring.
            branding_count = sum(
                content.count(pair[0])
                for pair in self.config.substitution_pairs
            )

            # Count hunks from the original conflict.
            hunk_count = 1
            for f in llm_files:
                if f.path == file_path:
                    hunk_count = len(f.hunks) or 1
                    break

            confidence = compute_confidence(
                llm_confidence, validation_errors, branding_count, hunk_count
            )

            # Write to disk and stage.
            self._write_resolution(file_path, content)

            return Resolution(
                file_path=file_path,
                category=category,
                action="resolve_conflict",
                content=content,
                explanation=explanation,
                confidence=confidence,
                validation_errors=validation_errors,
            )

        if tool == "keep_ours":
            self._checkout_ours(file_path)
            return Resolution(
                file_path=file_path,
                category=category,
                action="keep_ours",
                explanation=result.get("explanation", ""),
                confidence=ConfidenceLevel.HIGH,
            )

        if tool == "accept_theirs":
            self._checkout_theirs(file_path)
            return Resolution(
                file_path=file_path,
                category=category,
                action="accept_theirs",
                explanation=result.get("explanation", ""),
                confidence=ConfidenceLevel.HIGH,
            )

        # flag_for_review
        return Resolution(
            file_path=file_path,
            category=category,
            action="flag_for_review",
            content=result.get("suggested_resolution", ""),
            explanation=result.get("reason", ""),
            confidence=ConfidenceLevel.LOW,
        )

    # ------------------------------------------------------------------
    # Special cases
    # ------------------------------------------------------------------

    def _handle_package_lock(self, file_path: str) -> Resolution:
        """Handle package-lock.json by accepting upstream's package.json + lock."""
        logger.info("Special case: %s — accepting upstream", file_path)

        pkg_json = str(Path(file_path).parent / "package.json")
        self._checkout_theirs(pkg_json)
        self._checkout_theirs(file_path)

        return Resolution(
            file_path=file_path,
            category="special",
            action="accept_theirs",
            explanation=(
                "package-lock.json — accepted upstream's package.json and "
                "package-lock.json to keep dependency tree consistent."
            ),
            confidence=ConfidenceLevel.HIGH,
        )

    # ------------------------------------------------------------------
    # Git operations
    # ------------------------------------------------------------------

    def _get_conflicted_files(self) -> list[str]:
        """Get the list of files with merge conflicts."""
        result = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=U"],
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=True,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]

    def _checkout_ours(self, file_path: str) -> None:
        """Checkout our version of a file and stage it."""
        if self.dry_run:
            logger.info("[DRY RUN] Would checkout --ours %s", file_path)
            return

        subprocess.run(
            ["git", "checkout", "--ours", file_path],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "add", file_path],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

    def _checkout_theirs(self, file_path: str) -> None:
        """Checkout upstream's version of a file and stage it."""
        if self.dry_run:
            logger.info("[DRY RUN] Would checkout --theirs %s", file_path)
            return

        subprocess.run(
            ["git", "checkout", "--theirs", file_path],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "add", file_path],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

    def _write_resolution(self, file_path: str, content: str) -> None:
        """Write resolved content to disk and stage the file."""
        if self.dry_run:
            logger.info("[DRY RUN] Would write resolution for %s", file_path)
            return

        full_path = self.repo_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")

        subprocess.run(
            ["git", "add", file_path],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )
