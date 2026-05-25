"""End-to-end workflow tests for the branding conflict resolver v2.

Tests the tiered model escalation and self-healing repair loop architecture.
"""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

from branding_resolver.config import BrandingConfig
from branding_resolver.confidence import ConfidenceLevel
from branding_resolver.model_client import ModelTier
from branding_resolver.resolver import BrandingResolver, Resolution, MergeResult
from tests.conftest import (
    git_command_router,
    make_openai_tool_call,
    make_openai_response,
)


class TestWorkflowE2E:
    """Test the full resolve_merge() workflow with mocked git and API."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        """Set up a resolver with mocked dependencies for each test."""
        self.repo_path = tmp_path
        self.config = BrandingConfig()
        # Create sync-output dir that __main__.py expects
        (tmp_path / "sync-output").mkdir()

    def _make_resolver(self, dry_run=False, num_tiers=1):
        """Create a resolver with test tiers. max_repair_rounds=0 disables repair loop."""
        tiers = [ModelTier(name="tier1", provider="openrouter", model="test/model", api_key="test-key")]
        if num_tiers >= 2:
            tiers.append(ModelTier(name="tier2", provider="openrouter", model="test/model-v2", api_key="test-key"))
        return BrandingResolver(
            repo_path=self.repo_path,
            config=self.config,
            tiers=tiers,
            dry_run=dry_run,
            max_repair_rounds=0,  # Disable repair loop to keep tests focused
        )

    def _mock_agent_resolve(self, resolver, tier_name, return_value):
        """Mock the resolve_files method on a specific tier's agent."""
        resolver._agents[tier_name].resolve_files = MagicMock(return_value=return_value)

    def _mock_agent_exploration(self, resolver, tier_name, return_value_or_side_effect):
        """Mock the resolve_files_with_exploration method on a specific tier's agent."""
        if callable(return_value_or_side_effect) and not isinstance(return_value_or_side_effect, list):
            resolver._agents[tier_name].resolve_files_with_exploration = MagicMock(
                side_effect=return_value_or_side_effect
            )
        else:
            resolver._agents[tier_name].resolve_files_with_exploration = MagicMock(
                return_value=return_value_or_side_effect
            )

    # ------------------------------------------------------------------
    # No conflicts
    # ------------------------------------------------------------------

    @patch("subprocess.run")
    def test_clean_merge_no_conflicts(self, mock_run):
        """When no files are conflicted, nothing happens."""
        mock_run.side_effect = git_command_router([])
        resolver = self._make_resolver()
        result = resolver.resolve_merge()

        assert result.total_files == 0
        assert result.auto_resolved == 0
        assert result.flagged_for_review == 0
        assert result.api_calls_made == 0

    # ------------------------------------------------------------------
    # Category A: pure branding -> keep_ours
    # ------------------------------------------------------------------

    @patch("subprocess.run")
    def test_pure_branding_files_keep_ours(self, mock_run):
        """Pure branding files (category A) are auto-resolved with keep_ours."""
        files = ["packages/assets/logo.png", "apps/remix/public/favicon.ico"]
        mock_run.side_effect = git_command_router(files)
        resolver = self._make_resolver()
        result = resolver.resolve_merge()

        assert result.total_files == 2
        assert result.auto_resolved == 2
        assert result.flagged_for_review == 0
        assert result.api_calls_made == 0
        for res in result.resolutions:
            assert res.action == "keep_ours"
            assert res.category == "A"
            assert res.confidence == ConfidenceLevel.HIGH

    # ------------------------------------------------------------------
    # Category C: pure functional -> accept_theirs
    # ------------------------------------------------------------------

    @patch("subprocess.run")
    def test_pure_functional_accept_theirs(self, mock_run):
        """Pure functional files (category C) are auto-resolved with accept_theirs."""
        files = ["packages/prisma/migrations/001/migration.sql"]
        mock_run.side_effect = git_command_router(files)
        resolver = self._make_resolver()
        result = resolver.resolve_merge()

        assert result.total_files == 1
        assert result.auto_resolved == 1
        assert result.api_calls_made == 0
        assert result.resolutions[0].action == "accept_theirs"
        assert result.resolutions[0].category == "C"

    # ------------------------------------------------------------------
    # Category B: mixed branding -> LLM call
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_mixed_file_calls_llm(self, mock_run, mock_build_conflict):
        """Mixed branding files (category B) are sent to the LLM."""
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = ["packages/lib/constants/app.ts"]
        mock_run.side_effect = git_command_router(files)

        mock_build_conflict.return_value = FileConflict(
            path="packages/lib/constants/app.ts",
            hunks=[ConflictHunk(
                ours='export const APP_NAME = "Davinci Sign";\n',
                theirs='export const APP_NAME = "Documenso";\n',
                context_before="",
                context_after="",
                start_line=1,
                end_line=5,
            )],
        )

        resolved_content = (
            'export const APP_NAME = "Davinci Sign";\n'
            'export const APP_VERSION = "2.6.0";\n'
        )

        resolver = self._make_resolver()
        self._mock_agent_resolve(resolver, "tier1", [{
            "tool": "resolve_conflict",
            "file_path": "packages/lib/constants/app.ts",
            "resolved_content": resolved_content,
            "explanation": "Kept Davinci Sign branding, accepted version bump.",
            "confidence": "high",
        }])

        # Create the file so _write_resolution can write to it
        file_path = self.repo_path / "packages/lib/constants/app.ts"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("placeholder")

        result = resolver.resolve_merge()

        assert result.total_files == 1
        assert result.api_calls_made == 1
        assert result.resolutions[0].action == "resolve_conflict"
        assert result.resolutions[0].category == "B"

    # ------------------------------------------------------------------
    # Validation errors degrade confidence
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_mixed_file_brand_leak_is_auto_cleaned(self, mock_run, mock_build_conflict):
        """LLM output containing upstream brand strings is fixed by the
        deterministic substitution pass before validation, so the resolution
        succeeds with HIGH confidence and no validation errors.

        (Previously this test asserted the leak degraded confidence; that
        contract changed when deterministic.apply_substitutions was added
        to resolver._process_and_repair — branding-only misses now never
        reach the validator as errors.)
        """
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = ["packages/lib/constants/app.ts"]
        mock_run.side_effect = git_command_router(files)

        mock_build_conflict.return_value = FileConflict(
            path="packages/lib/constants/app.ts",
            hunks=[ConflictHunk(
                ours='const name = "Davinci Sign";\n',
                theirs='const name = "Documenso";\n',
                context_before="",
                context_after="",
                start_line=1,
                end_line=5,
            )],
        )

        # LLM returns content with upstream brand leaks the regex pass will fix.
        leaked_content = (
            'const name = "Documenso";\n'
            'const url = "https://documenso.com";\n'
        )

        resolver = self._make_resolver()
        self._mock_agent_resolve(resolver, "tier1", [{
            "tool": "resolve_conflict",
            "file_path": "packages/lib/constants/app.ts",
            "resolved_content": leaked_content,
            "explanation": "Merged changes.",
            "confidence": "high",
        }])

        file_path = self.repo_path / "packages/lib/constants/app.ts"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("placeholder")

        result = resolver.resolve_merge()

        res = result.resolutions[0]
        assert res.action == "resolve_conflict"
        assert res.confidence == ConfidenceLevel.HIGH
        assert res.validation_errors == []
        # Deterministic substitution rewrote both leaked strings.
        assert "Documenso" not in (res.content or "")
        assert "documenso.com" not in (res.content or "")
        assert 'const name = "Davinci Sign";' in (res.content or "")
        assert "https://davincisolutions.ai" in (res.content or "")

    # ------------------------------------------------------------------
    # All files flagged for review
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_all_flagged_scenario(self, mock_run, mock_build_conflict):
        """When all files are flagged for review."""
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = [".env.example", "README.md", "docker/build.sh"]
        mock_run.side_effect = git_command_router(files)

        def build_conflict_side_effect(file_path, repo_path):
            return FileConflict(
                path=file_path,
                hunks=[ConflictHunk(
                    ours="ours", theirs="theirs",
                    context_before="", context_after="",
                    start_line=1, end_line=3,
                )],
            )

        mock_build_conflict.side_effect = build_conflict_side_effect

        # LLM flags all for review
        resolver = self._make_resolver()
        self._mock_agent_resolve(resolver, "tier1", [
            {
                "tool": "flag_for_review",
                "file_path": f,
                "reason": "Complex conflict.",
                "suggested_resolution": "Manual review.",
                "ours_snippet": "ours",
                "theirs_snippet": "theirs",
            }
            for f in files
        ])

        result = resolver.resolve_merge()

        assert result.flagged_for_review == 3
        assert result.auto_resolved == 0
        for res in result.resolutions:
            assert res.confidence == ConfidenceLevel.LOW

    # ------------------------------------------------------------------
    # Special case: package-lock.json
    # ------------------------------------------------------------------

    @patch("subprocess.run")
    def test_package_lock_special_case(self, mock_run):
        """package-lock.json triggers special handling: checkout --theirs for both lock and package.json."""
        files = ["package-lock.json"]
        mock_run.side_effect = git_command_router(files)
        resolver = self._make_resolver()
        result = resolver.resolve_merge()

        assert result.total_files == 1
        assert result.api_calls_made == 0
        res = result.resolutions[0]
        assert res.action == "accept_theirs"
        assert res.category == "special"
        assert res.confidence == ConfidenceLevel.HIGH

        # Verify both package.json and package-lock.json had checkout --theirs
        checkout_calls = [
            c for c in mock_run.call_args_list
            if "checkout" in str(c) and "--theirs" in str(c)
        ]
        assert len(checkout_calls) == 2  # package.json + package-lock.json

    # ------------------------------------------------------------------
    # LLM misses a file -> auto-flagged
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_llm_misses_file(self, mock_run, mock_build_conflict):
        """Files missed by the LLM are auto-flagged for review."""
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = [".env.example", "README.md"]
        mock_run.side_effect = git_command_router(files)

        def build_conflict_side_effect(file_path, repo_path):
            return FileConflict(
                path=file_path,
                hunks=[ConflictHunk(
                    ours="ours", theirs="theirs",
                    context_before="", context_after="",
                    start_line=1, end_line=3,
                )],
            )

        mock_build_conflict.side_effect = build_conflict_side_effect

        # LLM only responds for the first file (misses README.md).
        # The mock must include the auto-flagged missed file since we're
        # mocking at the resolve_files level (above the safety check).
        resolver = self._make_resolver()
        self._mock_agent_resolve(resolver, "tier1", [
            {
                "tool": "resolve_conflict",
                "file_path": ".env.example",
                "resolved_content": "resolved content",
                "explanation": "Merged.",
                "confidence": "high",
            },
            {
                "tool": "flag_for_review",
                "file_path": "README.md",
                "reason": "LLM did not return a resolution for this file.",
                "suggested_resolution": "",
                "ours_snippet": "",
                "theirs_snippet": "",
            },
        ])

        file_path = self.repo_path / ".env.example"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("placeholder")

        # README.md also needs to exist for _read_file_with_conflicts
        readme_path = self.repo_path / "README.md"
        readme_path.write_text("placeholder")

        result = resolver.resolve_merge()

        # Find the missed file — it should be flagged
        missed = [r for r in result.resolutions if r.file_path == "README.md"]
        assert len(missed) == 1
        assert missed[0].action == "flag_for_review"

    # ------------------------------------------------------------------
    # Mixed batch: A + C + special, no LLM calls
    # ------------------------------------------------------------------

    @patch("subprocess.run")
    def test_mixed_batch_multiple_categories(self, mock_run):
        """Test routing of a mix of categories: A, C, and special — all auto-resolved."""
        files = [
            "packages/assets/logo.png",              # Category A - pure branding
            "packages/prisma/migrations/001/m.sql",  # Category C - functional
            "package-lock.json",                      # Special case
        ]
        mock_run.side_effect = git_command_router(files)
        resolver = self._make_resolver()
        result = resolver.resolve_merge()

        assert result.total_files == 3
        assert result.api_calls_made == 0  # All auto-resolved

        actions = {r.file_path: r.action for r in result.resolutions}
        assert actions["packages/assets/logo.png"] == "keep_ours"
        assert actions["packages/prisma/migrations/001/m.sql"] == "accept_theirs"
        assert actions["package-lock.json"] == "accept_theirs"

    # ------------------------------------------------------------------
    # Dry run mode
    # ------------------------------------------------------------------

    @patch("subprocess.run")
    def test_dry_run_skips_git_writes(self, mock_run):
        """In dry_run mode, git checkout/add are not called for auto-resolved files."""
        files = ["packages/assets/logo.png"]
        mock_run.side_effect = git_command_router(files)
        resolver = self._make_resolver(dry_run=True)
        result = resolver.resolve_merge()

        assert result.total_files == 1
        assert result.auto_resolved == 1

        # Only the initial git diff call should have happened, no checkout/add
        checkout_calls = [
            c for c in mock_run.call_args_list
            if "checkout" in str(c)
        ]
        assert len(checkout_calls) == 0

    # ------------------------------------------------------------------
    # Tiered escalation: tier1 fails, tier2 resolves
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_tier_escalation_resolves(self, mock_run, mock_build_conflict):
        """A file flagged by tier1 gets resolved by tier2 with exploration."""
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = [".env.example"]
        mock_run.side_effect = git_command_router(files)

        mock_build_conflict.return_value = FileConflict(
            path=".env.example",
            hunks=[ConflictHunk(
                ours="OUR_VAR=davinci\n", theirs="OUR_VAR=documenso\n",
                context_before="", context_after="",
                start_line=1, end_line=3,
            )],
        )

        # Use 2 tiers for escalation testing.
        resolver = self._make_resolver(num_tiers=2)

        # Tier 1: LLM flags for review
        self._mock_agent_resolve(resolver, "tier1", [{
            "tool": "flag_for_review",
            "file_path": ".env.example",
            "reason": "Need more context about OUR_VAR usage.",
            "suggested_resolution": "Check usage.",
            "ours_snippet": "OUR_VAR=davinci",
            "theirs_snippet": "OUR_VAR=documenso",
        }])

        # Tier 2: LLM resolves confidently after exploration
        self._mock_agent_exploration(resolver, "tier2", [{
            "tool": "resolve_conflict",
            "file_path": ".env.example",
            "resolved_content": "OUR_VAR=davinci\nNEW_VAR=value\n",
            "explanation": "After searching codebase, confirmed OUR_VAR is branding.",
            "confidence": "high",
        }])

        env_path = self.repo_path / ".env.example"
        env_path.write_text("placeholder")

        result = resolver.resolve_merge()

        # The file should now be resolved (not flagged)
        res = result.resolutions[0]
        assert res.action == "resolve_conflict"
        assert res.tier_used == "tier2"
        # Tier 2 was called
        resolver._agents["tier2"].resolve_files_with_exploration.assert_called_once()

    # ------------------------------------------------------------------
    # Tiered escalation: both tiers fail -> unresolvable
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_all_tiers_fail_marks_unresolvable(self, mock_run, mock_build_conflict):
        """When all tiers fail, the file is marked unresolvable."""
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = [".env.example"]
        mock_run.side_effect = git_command_router(files)

        mock_build_conflict.return_value = FileConflict(
            path=".env.example",
            hunks=[ConflictHunk(
                ours="ours\n", theirs="theirs\n",
                context_before="", context_after="",
                start_line=1, end_line=3,
            )],
        )

        resolver = self._make_resolver(num_tiers=2)

        # Both tiers flag for review
        self._mock_agent_resolve(resolver, "tier1", [{
            "tool": "flag_for_review",
            "file_path": ".env.example",
            "reason": "Unclear.",
            "suggested_resolution": "",
            "ours_snippet": "", "theirs_snippet": "",
        }])

        self._mock_agent_exploration(resolver, "tier2", [{
            "tool": "flag_for_review",
            "file_path": ".env.example",
            "reason": "Still cannot resolve.",
            "suggested_resolution": "",
            "ours_snippet": "", "theirs_snippet": "",
        }])

        env_path = self.repo_path / ".env.example"
        env_path.write_text("placeholder")

        result = resolver.resolve_merge()

        assert len(result.unresolvable_files) == 1
        assert ".env.example" in result.unresolvable_files
        assert result.flagged_for_review == 1

    # ------------------------------------------------------------------
    # Dry run skips tier escalation for flagged files
    # ------------------------------------------------------------------

    @patch("branding_resolver.resolver.build_file_conflict")
    @patch("subprocess.run")
    def test_dry_run_skips_second_pass(self, mock_run, mock_build_conflict):
        """In dry_run mode, tier escalation still happens but no files are written."""
        from branding_resolver.differ import FileConflict, ConflictHunk

        files = [".env.example"]
        mock_run.side_effect = git_command_router(files)

        mock_build_conflict.return_value = FileConflict(
            path=".env.example",
            hunks=[ConflictHunk(
                ours="ours\n", theirs="theirs\n",
                context_before="", context_after="",
                start_line=1, end_line=3,
            )],
        )

        resolver = self._make_resolver(dry_run=True)
        self._mock_agent_resolve(resolver, "tier1", [{
            "tool": "flag_for_review",
            "file_path": ".env.example",
            "reason": "Unclear.",
            "suggested_resolution": "",
            "ours_snippet": "", "theirs_snippet": "",
        }])

        result = resolver.resolve_merge()

        assert result.flagged_for_review == 1
