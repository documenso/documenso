"""CLI entrypoint tests."""

import pytest
from unittest.mock import patch, MagicMock

from branding_resolver.__main__ import main
from branding_resolver.confidence import ConfidenceLevel
from branding_resolver.resolver import Resolution, MergeResult


def _make_merge_result(flagged=0, total=3, unresolvable=None, resolutions=None):
    """Create a MergeResult for testing."""
    if unresolvable is None:
        unresolvable = [f"flagged{i}.ts" for i in range(flagged)] if flagged > 0 else []

    if resolutions is None:
        resolutions = [
            Resolution(
                file_path=f"file{i}.ts",
                category="B",
                action="resolve_conflict",
                explanation="Merged.",
                confidence=ConfidenceLevel.HIGH,
            )
            for i in range(total - flagged)
        ]
        resolutions += [
            Resolution(
                file_path=f"flagged{i}.ts",
                category="B",
                action="flag_for_review",
                explanation="Needs review.",
                confidence=ConfidenceLevel.LOW,
            )
            for i in range(flagged)
        ]

    return MergeResult(
        resolutions=resolutions,
        total_files=total,
        auto_resolved=total - flagged,
        flagged_for_review=flagged,
        unresolvable_files=unresolvable,
        api_calls_made=1,
        total_input_tokens=500,
        total_output_tokens=200,
    )


class TestCLI:
    """Test CLI entrypoint behavior."""

    @patch("branding_resolver.resolver.BrandingResolver")
    def test_returns_0_when_clean(self, mock_resolver_cls, tmp_path):
        mock_resolver = MagicMock()
        mock_resolver.resolve_merge.return_value = _make_merge_result(flagged=0)
        mock_resolver_cls.return_value = mock_resolver

        exit_code = main(["--repo", str(tmp_path)])
        assert exit_code == 0

    @patch("branding_resolver.resolver.BrandingResolver")
    def test_returns_1_when_flagged(self, mock_resolver_cls, tmp_path):
        mock_resolver = MagicMock()
        mock_resolver.resolve_merge.return_value = _make_merge_result(flagged=2)
        mock_resolver_cls.return_value = mock_resolver

        exit_code = main(["--repo", str(tmp_path)])
        assert exit_code == 1

    @patch("branding_resolver.resolver.BrandingResolver")
    def test_writes_confidence_file(self, mock_resolver_cls, tmp_path):
        mock_resolver = MagicMock()
        mock_resolver.resolve_merge.return_value = _make_merge_result(flagged=0)
        mock_resolver_cls.return_value = mock_resolver

        main(["--repo", str(tmp_path)])

        confidence_file = tmp_path / "sync-output" / "confidence.txt"
        assert confidence_file.exists()
        score = float(confidence_file.read_text().strip())
        assert 0.0 <= score <= 1.0

    @patch("branding_resolver.resolver.BrandingResolver")
    def test_writes_pr_body(self, mock_resolver_cls, tmp_path):
        mock_resolver = MagicMock()
        mock_resolver.resolve_merge.return_value = _make_merge_result(flagged=0)
        mock_resolver_cls.return_value = mock_resolver

        pr_body_path = tmp_path / "pr_body.md"
        main(["--repo", str(tmp_path), "--output-pr-body", str(pr_body_path)])

        assert pr_body_path.exists()
        content = pr_body_path.read_text()
        assert len(content) > 0

    @patch("branding_resolver.resolver.BrandingResolver")
    def test_dry_run_flag(self, mock_resolver_cls, tmp_path):
        mock_resolver = MagicMock()
        mock_resolver.resolve_merge.return_value = _make_merge_result(flagged=0)
        mock_resolver_cls.return_value = mock_resolver

        main(["--repo", str(tmp_path), "--dry-run"])

        # Verify resolver was created with dry_run=True
        call_kwargs = mock_resolver_cls.call_args
        assert call_kwargs.kwargs.get("dry_run") is True
