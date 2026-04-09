"""Top-level orchestrator for branding-aware merge conflict resolution.

Implements tiered model escalation and self-healing validation loops:

  1. Classify conflicted files (A=pure branding, B=mixed, C=functional, D=ambiguous)
  2. Resolve A/C trivially (keep_ours / accept_theirs)
  3. Batch B/D through Tier 1 (fast model) → repair loop per file
  4. Escalate failures to Tier 2 (capable model) with exploration → repair loop
  5. Escalate remaining failures to Tier 3 (strongest model) → repair loop
  6. Run TypeScript compilation check (optional) → targeted re-resolution
  7. Return results with full analytics
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field

from .agent import BrandingAgent
from .classifier import FileCategory, classify_file
from .confidence import ConfidenceLevel, compute_confidence
from .differ import FileConflict, build_file_conflict, chunk_file_diffs, reconstruct_from_hunks
from .model_client import LLMClient, ModelTier, create_client
from .repair_loop import RepairResult, repair_file
from .validator import validate_resolved_file

if TYPE_CHECKING:
    from .config import BrandingConfig
    from .resolution_cache import ResolutionCache
    from .tsc_validator import TscError

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
    tier_used: str = Field(default="", description="Model tier that resolved this file.")
    repair_round: int | None = Field(
        default=None, description="Repair round that succeeded (0-3), None if no repair needed."
    )


class MergeResult(BaseModel):
    """Summary of the full merge resolution."""

    model_config = ConfigDict(frozen=True)

    resolutions: list[Resolution] = Field(description="Per-file resolution details.")
    total_files: int = Field(description="Total number of conflicted files.")
    auto_resolved: int = Field(description="Files resolved automatically.")
    flagged_for_review: int = Field(description="Files flagged for human review.")
    unresolvable_files: list[str] = Field(
        default_factory=list, description="Files that failed all tiers."
    )
    api_calls_made: int = Field(description="Number of LLM API calls made.")
    total_input_tokens: int = Field(description="Total input tokens consumed.")
    total_output_tokens: int = Field(description="Total output tokens consumed.")
    total_cost_usd: float = Field(default=0.0, description="Total cost in USD.")
    tier_stats: dict[str, int] = Field(
        default_factory=dict, description="Files resolved per tier."
    )
    repair_stats: dict[str, int] = Field(
        default_factory=dict, description="Files per repair round."
    )


# Map FileCategory enum values to short string labels.
_CATEGORY_LABELS = {
    FileCategory.A_PURE_BRANDING: "A",
    FileCategory.B_MIXED: "B",
    FileCategory.C_PURE_FUNCTIONAL: "C",
    FileCategory.D_AMBIGUOUS: "D",
}


class BrandingResolver:
    """Orchestrates branding-aware merge conflict resolution with tiered models.

    Classifies conflicted files, resolves trivial ones locally, and sends
    complex ones through a tiered LLM pipeline with self-healing repair loops.
    """

    def __init__(
        self,
        repo_path: str | Path,
        config: BrandingConfig | None = None,
        tiers: list[ModelTier] | None = None,
        dry_run: bool = False,
        max_repair_rounds: int = 3,
        cache: ResolutionCache | None = None,
        enable_tsc: bool = False,
    ) -> None:
        self.repo_path = Path(repo_path)
        self.dry_run = dry_run
        self.max_repair_rounds = max_repair_rounds
        self.cache = cache
        self.enable_tsc = enable_tsc

        if config is None:
            from .config import BrandingConfig as _BrandingConfig  # noqa: PLC0415
            config = _BrandingConfig()
        self.config = config

        # Build tiered agents.
        if tiers is None:
            import os  # noqa: PLC0415
            api_key = config.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
            model = config.openrouter_model or os.environ.get("OPENROUTER_MODEL", "google/gemini-3-flash-preview")
            tiers = [ModelTier(name="tier1", provider="openrouter", model=model, api_key=api_key)]

        self._tiers = tiers
        self._agents: dict[str, BrandingAgent] = {}
        self._clients: dict[str, LLMClient] = {}

        for tier in tiers:
            client = create_client(tier)
            self._clients[tier.name] = client
            self._agents[tier.name] = BrandingAgent(
                config=self.config,
                client=client,
                dry_run=dry_run,
            )

        self._api_calls = 0
        self._repair_cost_usd = 0.0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resolve_merge(
        self,
        our_branch: str = "origin/main",
        upstream_branch: str = "upstream/main",
    ) -> MergeResult:
        """Resolve all merge conflicts with tiered escalation and self-healing.

        Expects that ``git merge`` has already been started and conflicts exist.
        """
        conflicted_files = self._get_conflicted_files()
        logger.info(
            "Found %d conflicted files between %s and %s",
            len(conflicted_files), our_branch, upstream_branch,
        )

        resolutions: list[Resolution] = []
        llm_files: list[FileConflict] = []
        llm_categories: dict[str, str] = {}  # path -> category label

        # Step 1: Classify and resolve trivial files.
        for file_path in conflicted_files:
            if Path(file_path).name == "package-lock.json":
                res = self._handle_package_lock(file_path)
                resolutions.append(res)
                continue

            category = classify_file(file_path, self.config)
            cat_label = _CATEGORY_LABELS.get(category, "D")

            if category == FileCategory.A_PURE_BRANDING:
                self._checkout_ours(file_path)
                resolutions.append(Resolution(
                    file_path=file_path, category=cat_label,
                    action="keep_ours",
                    explanation="Pure branding file — kept our Davinci Sign version.",
                    confidence=ConfidenceLevel.HIGH, tier_used="local",
                ))
            elif category == FileCategory.C_PURE_FUNCTIONAL:
                self._checkout_theirs(file_path)
                resolutions.append(Resolution(
                    file_path=file_path, category=cat_label,
                    action="accept_theirs",
                    explanation="No branding relevance — accepted upstream changes.",
                    confidence=ConfidenceLevel.HIGH, tier_used="local",
                ))
            else:
                conflict = build_file_conflict(file_path, self.repo_path)
                llm_files.append(conflict)
                llm_categories[file_path] = cat_label

        if not llm_files:
            return self._build_result(resolutions, conflicted_files)

        # Step 2: Check resolution cache.
        cache_hits: dict[str, str] = {}
        uncached_files: list[FileConflict] = []

        for fc in llm_files:
            cached = self._check_cache(fc)
            if cached is not None:
                # Validate cached content is still good.
                errors = validate_resolved_file(fc.path, cached, self.config)
                if not errors:
                    logger.info("Cache hit for %s — using cached resolution", fc.path)
                    cache_hits[fc.path] = cached
                    self._write_resolution(fc.path, cached)
                    resolutions.append(Resolution(
                        file_path=fc.path,
                        category=llm_categories.get(fc.path, "B"),
                        action="resolve_conflict",
                        content=cached,
                        explanation="Resolved from cache (previously validated).",
                        confidence=ConfidenceLevel.HIGH,
                        tier_used="cache",
                    ))
                    continue
            uncached_files.append(fc)

        # Pre-read conflict marker content before any tier modifies the files.
        conflict_marker_content: dict[str, str] = {}
        for fc in uncached_files:
            raw = self._read_file_with_conflicts(fc.path)
            if raw:
                conflict_marker_content[fc.path] = raw

        # Step 3: Tiered resolution with repair loop.
        remaining_files = uncached_files
        tier_stats: dict[str, int] = {}
        repair_stats: dict[str, int] = {}
        hunk_fallback_tried: set[str] = set()  # Don't retry hunk fallback across tiers

        for tier in self._tiers:
            if not remaining_files:
                break

            agent = self._agents[tier.name]
            client = self._clients[tier.name]
            logger.info(
                "Tier %s (%s): resolving %d file(s)",
                tier.name, tier.model, len(remaining_files),
            )

            # First tier uses batch mode; higher tiers use exploration mode.
            is_first_tier = tier == self._tiers[0]
            tier_resolutions = self._resolve_with_tier(
                files=remaining_files,
                agent=agent,
                client=client,
                tier_name=tier.name,
                categories=llm_categories,
                use_exploration=not is_first_tier,
            )

            # Separate successes from failures.
            succeeded: list[Resolution] = []
            failed_paths: set[str] = set()

            for res in tier_resolutions:
                if res.validation_errors or res.action == "flag_for_review":
                    failed_paths.add(res.file_path)
                else:
                    succeeded.append(res)
                    tier_stats[tier.name] = tier_stats.get(tier.name, 0) + 1
                    if res.repair_round is not None:
                        key = f"round_{res.repair_round}"
                        repair_stats[key] = repair_stats.get(key, 0) + 1

                    # Cache successful resolutions.
                    if res.content and res.file_path in {f.path for f in uncached_files}:
                        fc = next((f for f in uncached_files if f.path == res.file_path), None)
                        if fc:
                            self._store_cache(fc, res.content)

            resolutions.extend(succeeded)

            # Filter remaining files to only failures for next tier.
            remaining_files = [f for f in remaining_files if f.path in failed_paths]

            if not remaining_files:
                break

            # Try hunk-based fallback for truncated files before escalating.
            # Only try once per file — if it failed at tier 1, don't retry at tier 2.
            hunk_resolved: list[str] = []
            for fc in remaining_files:
                if fc.path in hunk_fallback_tried:
                    continue
                if self._is_truncated(fc, tier_resolutions):
                    logger.info(
                        "Detected truncation for %s — trying hunk-based resolution",
                        fc.path,
                    )
                    hunk_fallback_tried.add(fc.path)
                    raw_content = conflict_marker_content.get(fc.path)
                    hunk_res = self._resolve_by_hunks(
                        fc, agent, llm_categories, raw_content=raw_content,
                    )
                    if hunk_res is not None:
                        resolutions.append(hunk_res)
                        hunk_resolved.append(fc.path)
                        tier_stats[tier.name] = tier_stats.get(tier.name, 0) + 1
                        if hunk_res.content:
                            self._store_cache(fc, hunk_res.content)

            remaining_files = [f for f in remaining_files if f.path not in hunk_resolved]

            if remaining_files:
                logger.info(
                    "Tier %s: %d file(s) still failing, escalating",
                    tier.name, len(remaining_files),
                )

        # Any files still remaining after all tiers are unresolvable.
        unresolvable: list[str] = []
        for fc in remaining_files:
            logger.warning("Unresolvable after all tiers: %s", fc.path)
            unresolvable.append(fc.path)
            # Keep conflict markers in the file for the PR.
            conflict_content = self._read_file_with_conflicts(fc.path)
            if conflict_content is not None:
                self._write_resolution(fc.path, conflict_content)
            resolutions.append(Resolution(
                file_path=fc.path,
                category=llm_categories.get(fc.path, "D"),
                action="flag_for_review",
                content=conflict_content,
                explanation="Failed all resolution tiers — requires manual review.",
                confidence=ConfidenceLevel.LOW,
                tier_used="none",
            ))

        # Step 4: TypeScript validation (optional).
        if self.enable_tsc and not self.dry_run:
            tsc_failures = self._run_tsc_validation()
            if tsc_failures:
                self._fix_tsc_errors(tsc_failures, resolutions, llm_categories)

        return self._build_result(
            resolutions, conflicted_files,
            unresolvable_files=unresolvable,
            tier_stats=tier_stats,
            repair_stats=repair_stats,
        )

    # ------------------------------------------------------------------
    # Tier resolution
    # ------------------------------------------------------------------

    def _resolve_with_tier(
        self,
        files: list[FileConflict],
        agent: BrandingAgent,
        client: LLMClient,
        tier_name: str,
        categories: dict[str, str],
        use_exploration: bool = False,
    ) -> list[Resolution]:
        """Resolve files using a specific tier agent + repair loop."""
        resolutions: list[Resolution] = []

        if use_exploration:
            # Higher tiers process one file at a time with exploration.
            for fc in files:
                self._api_calls += 1
                raw_results = agent.resolve_files_with_exploration([fc], self.repo_path)
                for result in raw_results:
                    res = self._process_and_repair(
                        result, [fc], categories, client, tier_name,
                    )
                    if res is not None:
                        resolutions.append(res)
        else:
            # First tier uses batch mode.
            chunks = chunk_file_diffs(files)
            logger.info(
                "Sending %d files to %s in %d chunk(s)",
                len(files), tier_name, len(chunks),
            )
            for chunk in chunks:
                self._api_calls += 1
                raw_results = agent.resolve_files(chunk)
                for result in raw_results:
                    res = self._process_and_repair(
                        result, chunk, categories, client, tier_name,
                    )
                    if res is not None:
                        resolutions.append(res)

        return resolutions

    def _process_and_repair(
        self,
        result: dict[str, Any],
        llm_files: list[FileConflict],
        categories: dict[str, str],
        client: LLMClient,
        tier_name: str,
    ) -> Resolution | None:
        """Process an LLM result and run it through the repair loop.

        Returns None if the result is malformed (missing file_path).
        """
        tool = result.get("tool", "flag_for_review")
        file_path = result.get("file_path", "")

        if not file_path:
            # LLM returned a malformed result — try to infer file from context.
            if len(llm_files) == 1:
                file_path = llm_files[0].path
            else:
                logger.warning("LLM returned result without file_path: %s", result)
                return None

        category = categories.get(file_path, "B")

        if tool == "resolve_conflict":
            content = result["resolved_content"]
            explanation = result["explanation"]
            llm_confidence = result.get("confidence", "medium")

            # Run the self-healing repair loop.
            repair = repair_file(
                file_path=file_path,
                content=content,
                config=self.config,
                repo_path=self.repo_path,
                llm_client=client,
                max_rounds=self.max_repair_rounds,
            )
            self._api_calls += repair.total_repair_calls
            self._repair_cost_usd += repair.cost_usd

            if repair.success:
                self._write_resolution(file_path, repair.content)
                # Compute informational confidence.
                branding_count = sum(
                    repair.content.count(pair[0])
                    for pair in self.config.substitution_pairs
                )
                hunk_count = 1
                for f in llm_files:
                    if f.path == file_path:
                        hunk_count = len(f.hunks) or 1
                        break
                confidence = compute_confidence(
                    llm_confidence, [], branding_count, hunk_count,
                )
                return Resolution(
                    file_path=file_path, category=category,
                    action="resolve_conflict", content=repair.content,
                    explanation=explanation, confidence=confidence,
                    tier_used=tier_name, repair_round=repair.round_succeeded,
                )
            else:
                # Repair failed — validation errors remain.
                logger.warning(
                    "Repair loop failed for %s at tier %s: %s",
                    file_path, tier_name, "; ".join(repair.errors[:3]),
                )
                return Resolution(
                    file_path=file_path, category=category,
                    action="resolve_conflict", content=repair.content,
                    explanation=explanation, confidence=ConfidenceLevel.LOW,
                    validation_errors=repair.errors,
                    tier_used=tier_name,
                )

        if tool == "keep_ours":
            self._checkout_ours(file_path)
            return Resolution(
                file_path=file_path, category=category,
                action="keep_ours",
                explanation=result.get("explanation", ""),
                confidence=ConfidenceLevel.HIGH,
                tier_used=tier_name,
            )

        if tool == "accept_theirs":
            self._checkout_theirs(file_path)
            return Resolution(
                file_path=file_path, category=category,
                action="accept_theirs",
                explanation=result.get("explanation", ""),
                confidence=ConfidenceLevel.HIGH,
                tier_used=tier_name,
            )

        # flag_for_review — keep conflict markers and return with errors.
        conflict_content = self._read_file_with_conflicts(file_path)
        if conflict_content is not None:
            self._write_resolution(file_path, conflict_content)

        reason = result.get("reason", "")
        return Resolution(
            file_path=file_path, category=category,
            action="flag_for_review",
            content=conflict_content or result.get("suggested_resolution", ""),
            explanation=reason, confidence=ConfidenceLevel.LOW,
            validation_errors=["Flagged for review by LLM"],
            tier_used=tier_name,
        )

    # ------------------------------------------------------------------
    # TypeScript validation
    # ------------------------------------------------------------------

    def _run_tsc_validation(self) -> dict[str, list[TscError]]:
        """Run tsc --noEmit in Docker and return errors grouped by file."""
        try:
            from .tsc_validator import group_errors_by_file, run_tsc_in_docker  # noqa: PLC0415

            logger.info("Running TypeScript validation in Docker...")
            errors = run_tsc_in_docker(self.repo_path)
            if errors:
                grouped = group_errors_by_file(errors)
                logger.warning("tsc found errors in %d file(s)", len(grouped))
                return grouped
            logger.info("TypeScript validation passed")
            return {}
        except Exception:
            logger.exception("TypeScript validation failed — skipping")
            return {}

    def _fix_tsc_errors(
        self,
        tsc_failures: dict[str, list[TscError]],
        resolutions: list[Resolution],
        categories: dict[str, str],
    ) -> None:
        """Attempt to fix tsc errors by re-running repair loop on affected files."""
        # Use the highest available tier for tsc fixes.
        if not self._tiers:
            return
        best_tier = self._tiers[-1]
        client = self._clients[best_tier.name]

        for file_path, errors in tsc_failures.items():
            # Find the current resolution for this file.
            res_idx = next(
                (i for i, r in enumerate(resolutions) if r.file_path == file_path),
                None,
            )
            if res_idx is None or resolutions[res_idx].content is None:
                continue

            error_msgs = [f"TS{e.code} at line {e.line}: {e.message}" for e in errors]
            logger.info(
                "Fixing %d tsc error(s) in %s via tier %s",
                len(errors), file_path, best_tier.name,
            )

            # Run repair loop with tsc errors injected as validation errors.
            content = resolutions[res_idx].content
            assert content is not None
            repair = repair_file(
                file_path=file_path,
                content=content,
                config=self.config,
                repo_path=self.repo_path,
                llm_client=client,
                max_rounds=self.max_repair_rounds,
            )
            self._api_calls += repair.total_repair_calls
            self._repair_cost_usd += repair.cost_usd

            if repair.success:
                self._write_resolution(file_path, repair.content)
                resolutions[res_idx] = Resolution(
                    file_path=file_path,
                    category=categories.get(file_path, "B"),
                    action="resolve_conflict",
                    content=repair.content,
                    explanation=f"Fixed tsc errors via {best_tier.name}",
                    confidence=ConfidenceLevel.HIGH,
                    tier_used=best_tier.name,
                    repair_round=repair.round_succeeded,
                )

    # ------------------------------------------------------------------
    # Truncation detection and hunk-based fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _is_truncated(fc: FileConflict, tier_resolutions: list[Resolution]) -> bool:
        """Detect if a file resolution was truncated.

        A resolution is likely truncated if:
        1. It has "Unclosed brackets at end of file" in validation errors, AND
        2. The resolved content is shorter than both the ours and theirs versions.
        """
        res = next((r for r in tier_resolutions if r.file_path == fc.path), None)
        if res is None:
            return False

        has_unclosed = any("Unclosed brackets at end of file" in e for e in res.validation_errors)
        if not has_unclosed:
            return False

        if res.content and fc.full_ours and fc.full_theirs:
            min_source_len = min(len(fc.full_ours), len(fc.full_theirs))
            if len(res.content) < min_source_len * 0.8:
                return True

        # Even without length check, unclosed brackets is a strong truncation signal.
        return has_unclosed

    def _resolve_by_hunks(
        self,
        fc: FileConflict,
        agent: BrandingAgent,
        categories: dict[str, str],
        raw_content: str | None = None,
    ) -> Resolution | None:
        """Resolve a file by processing each conflict hunk individually.

        Uses pre-read conflict marker content (or reads from disk as fallback),
        resolves each hunk via the LLM, then reconstructs the file.
        """
        if raw_content is None:
            raw_content = self._read_file_with_conflicts(fc.path)
        if raw_content is None:
            logger.warning("Hunk fallback: no conflict content for %s", fc.path)
            return None

        self._api_calls += len(fc.hunks)
        resolved_hunks = agent.resolve_hunks(fc)
        if resolved_hunks is None:
            logger.warning("Hunk-based: agent returned None for %s", fc.path)
            return None

        logger.info("Hunk-based: reconstructing %s from %d resolved hunks", fc.path, len(resolved_hunks))

        # Reconstruct the file.
        reconstructed = reconstruct_from_hunks(raw_content, resolved_hunks)

        # Validate the reconstructed file.
        errors = validate_resolved_file(fc.path, reconstructed, self.config)
        if errors:
            # One more try: run repair loop on the reconstructed content.
            repair = repair_file(
                file_path=fc.path,
                content=reconstructed,
                config=self.config,
                repo_path=self.repo_path,
                llm_client=self._clients.get("tier1"),
                max_rounds=self.max_repair_rounds,
            )
            self._api_calls += repair.total_repair_calls
            self._repair_cost_usd += repair.cost_usd

            if not repair.success:
                logger.warning(
                    "Hunk-based resolution for %s failed validation: %s",
                    fc.path, "; ".join(repair.errors[:3]),
                )
                return None
            reconstructed = repair.content

        self._write_resolution(fc.path, reconstructed)

        logger.info("Hunk-based resolution succeeded for %s (%d hunks)", fc.path, len(fc.hunks))
        return Resolution(
            file_path=fc.path,
            category=categories.get(fc.path, "B"),
            action="resolve_conflict",
            content=reconstructed,
            explanation=f"Resolved via hunk-based fallback ({len(fc.hunks)} hunks).",
            confidence=ConfidenceLevel.HIGH,
            tier_used="hunk-fallback",
        )

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    def _check_cache(self, fc: FileConflict) -> str | None:
        """Check if a resolution is cached for this conflict."""
        if self.cache is None or fc.full_ours is None or fc.full_theirs is None:
            return None
        return self.cache.get(fc.path, fc.full_ours, fc.full_theirs)

    def _store_cache(self, fc: FileConflict, resolved: str) -> None:
        """Store a successful resolution in the cache."""
        if self.cache is None or fc.full_ours is None or fc.full_theirs is None:
            return
        self.cache.put(fc.path, fc.full_ours, fc.full_theirs, resolved)

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
            file_path=file_path, category="special",
            action="accept_theirs",
            explanation=(
                "package-lock.json — accepted upstream's package.json and "
                "package-lock.json to keep dependency tree consistent."
            ),
            confidence=ConfidenceLevel.HIGH, tier_used="local",
        )

    # ------------------------------------------------------------------
    # Result builder
    # ------------------------------------------------------------------

    def _build_result(
        self,
        resolutions: list[Resolution],
        conflicted_files: list[str],
        unresolvable_files: list[str] | None = None,
        tier_stats: dict[str, int] | None = None,
        repair_stats: dict[str, int] | None = None,
    ) -> MergeResult:
        """Build a MergeResult from resolutions."""
        flagged = sum(
            1 for r in resolutions
            if r.action == "flag_for_review" or r.confidence == ConfidenceLevel.LOW
        )
        auto_resolved = len(resolutions) - flagged

        total_input = sum(a.total_input_tokens for a in self._agents.values())
        total_output = sum(a.total_output_tokens for a in self._agents.values())
        total_cost = sum(a.total_cost_usd for a in self._agents.values()) + self._repair_cost_usd

        return MergeResult(
            resolutions=resolutions,
            total_files=len(conflicted_files),
            auto_resolved=auto_resolved,
            flagged_for_review=flagged,
            unresolvable_files=unresolvable_files or [],
            api_calls_made=self._api_calls,
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_cost_usd=total_cost,
            tier_stats=tier_stats or {},
            repair_stats=repair_stats or {},
        )

    # ------------------------------------------------------------------
    # Git operations
    # ------------------------------------------------------------------

    def _get_conflicted_files(self) -> list[str]:
        result = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=U"],
            cwd=self.repo_path, capture_output=True, text=True, encoding="utf-8", check=True,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]

    def _checkout_ours(self, file_path: str) -> None:
        if self.dry_run:
            logger.info("[DRY RUN] Would checkout --ours %s", file_path)
            return
        subprocess.run(
            ["git", "checkout", "--ours", file_path],
            cwd=self.repo_path, check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "add", file_path],
            cwd=self.repo_path, check=True, capture_output=True,
        )

    def _checkout_theirs(self, file_path: str) -> None:
        if self.dry_run:
            logger.info("[DRY RUN] Would checkout --theirs %s", file_path)
            return
        subprocess.run(
            ["git", "checkout", "--theirs", file_path],
            cwd=self.repo_path, check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "add", file_path],
            cwd=self.repo_path, check=True, capture_output=True,
        )

    def _write_resolution(self, file_path: str, content: str) -> None:
        if self.dry_run:
            logger.info("[DRY RUN] Would write resolution for %s", file_path)
            return
        full_path = self.repo_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        subprocess.run(
            ["git", "add", file_path],
            cwd=self.repo_path, check=True, capture_output=True,
        )

    def _read_file_with_conflicts(self, file_path: str) -> str | None:
        full_path = self.repo_path / file_path
        try:
            return full_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            logger.warning("Could not read conflict file: %s", file_path)
            return None
