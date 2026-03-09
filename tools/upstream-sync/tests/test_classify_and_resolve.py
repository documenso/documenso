"""Component integration tests for classifier, validator, and confidence."""

import pytest

from branding_resolver.classifier import FileCategory, classify_file
from branding_resolver.config import BrandingConfig
from branding_resolver.confidence import ConfidenceLevel, compute_confidence
from branding_resolver.differ import parse_conflict_markers
from branding_resolver.validator import validate_resolved_file


class TestClassifier:
    """Test file classification logic."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.config = BrandingConfig()

    def test_pure_branding_asset(self):
        assert classify_file("packages/assets/logo.png", self.config) == FileCategory.A_PURE_BRANDING

    def test_pure_branding_favicon(self):
        assert classify_file("apps/remix/public/favicon.ico", self.config) == FileCategory.A_PURE_BRANDING

    def test_mixed_branding_constants(self):
        assert classify_file("packages/lib/constants/app.ts", self.config) == FileCategory.B_MIXED

    def test_mixed_branding_env(self):
        assert classify_file(".env.example", self.config) == FileCategory.B_MIXED

    def test_pure_functional_migration(self):
        assert classify_file("packages/prisma/migrations/001/migration.sql", self.config) == FileCategory.C_PURE_FUNCTIONAL

    def test_pure_functional_test_file(self):
        assert classify_file("packages/lib/utils/auth.test.ts", self.config) == FileCategory.C_PURE_FUNCTIONAL

    def test_ambiguous_file(self):
        """Unknown file not matching any pattern."""
        result = classify_file("packages/lib/utils/some-new-util.ts", self.config)
        assert result in (FileCategory.C_PURE_FUNCTIONAL, FileCategory.D_AMBIGUOUS)


class TestValidator:
    """Test branding validation."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.config = BrandingConfig()

    def test_catches_upstream_brand_leak(self):
        content = 'const name = "Documenso";\nconst url = "https://documenso.com";\n'
        errors = validate_resolved_file("test.ts", content, self.config)
        assert len(errors) > 0

    def test_allows_preserved_package_scope(self):
        """@documenso/ package imports should NOT be flagged."""
        content = 'import { something } from "@documenso/lib";\n'
        errors = validate_resolved_file("test.ts", content, self.config)
        assert not any("@documenso/" in e for e in errors)

    def test_allows_github_credit_link(self):
        """github.com/documenso links should NOT be flagged."""
        content = '// Based on https://github.com/documenso/documenso\n'
        errors = validate_resolved_file("test.ts", content, self.config)
        assert not any("github.com/documenso" in e for e in errors)

    def test_catches_conflict_markers(self):
        content = 'normal code\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> upstream\n'
        errors = validate_resolved_file("test.ts", content, self.config)
        assert any("conflict" in e.lower() or "marker" in e.lower() for e in errors)

    def test_clean_content_passes(self):
        content = 'const name = "Davinci Sign";\nconst email = "support@davincisolutions.ai";\n'
        errors = validate_resolved_file("test.ts", content, self.config)
        assert len(errors) == 0


class TestConfidenceScoring:
    """Test confidence level computation."""

    def test_high_confidence_clean(self):
        result = compute_confidence("high", [], 0, 1)
        assert result == ConfidenceLevel.HIGH

    def test_validation_errors_degrade(self):
        result = compute_confidence("high", ["error1"], 0, 1)
        assert result != ConfidenceLevel.HIGH

    def test_low_llm_confidence(self):
        result = compute_confidence("low", [], 0, 1)
        assert result == ConfidenceLevel.LOW

    def test_many_errors_force_low(self):
        result = compute_confidence("high", ["e1", "e2", "e3"], 10, 5)
        assert result == ConfidenceLevel.LOW


class TestDiffParser:
    """Test conflict marker parsing."""

    def test_parses_single_conflict(self):
        content = (
            "normal line\n"
            "<<<<<<< ours\n"
            "our content\n"
            "=======\n"
            "their content\n"
            ">>>>>>> theirs\n"
            "more normal\n"
        )
        hunks = parse_conflict_markers(content)
        assert len(hunks) == 1
        assert "our content" in hunks[0].ours
        assert "their content" in hunks[0].theirs

    def test_parses_multiple_conflicts(self):
        content = (
            "line1\n"
            "<<<<<<< ours\n"
            "ours1\n"
            "=======\n"
            "theirs1\n"
            ">>>>>>> theirs\n"
            "middle\n"
            "<<<<<<< ours\n"
            "ours2\n"
            "=======\n"
            "theirs2\n"
            ">>>>>>> theirs\n"
        )
        hunks = parse_conflict_markers(content)
        assert len(hunks) == 2

    def test_no_conflicts(self):
        content = "just normal content\nno conflicts here\n"
        hunks = parse_conflict_markers(content)
        assert len(hunks) == 0
