"""CLI entrypoint for the branding conflict resolver.

Usage:
    python -m branding_resolver --repo . --dry-run --verbose
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from .config import BrandingConfig
from .confidence import ConfidenceLevel

logger = logging.getLogger("branding_resolver")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="branding_resolver",
        description="Resolve branding conflicts in Davinci Sign upstream merges.",
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Path to the git repository (default: current directory)",
    )
    parser.add_argument(
        "--our-branch",
        default="origin/main",
        help="Our branch ref (default: origin/main)",
    )
    parser.add_argument(
        "--upstream-branch",
        default="upstream/main",
        help="Upstream branch ref (default: upstream/main)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Classify and report without modifying files",
    )
    parser.add_argument(
        "--output-pr-body",
        type=str,
        default=None,
        metavar="FILE",
        help="Write a PR body summary to the specified file",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug-level logging",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # Set up logging.
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    logger.info("Branding conflict resolver starting")
    logger.info("Repo: %s", args.repo)
    logger.info("Our branch: %s", args.our_branch)
    logger.info("Upstream branch: %s", args.upstream_branch)

    config = BrandingConfig()

    from .resolver import BrandingResolver  # noqa: PLC0415

    api_key = config.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
    model = config.openrouter_model or os.environ.get("OPENROUTER_MODEL", "google/gemini-3-flash-preview")

    resolver = BrandingResolver(
        repo_path=args.repo,
        config=config,
        api_key=api_key,
        model=model,
        dry_run=args.dry_run,
    )

    result = resolver.resolve_merge(
        our_branch=args.our_branch,
        upstream_branch=args.upstream_branch,
    )

    # Print summary.
    logger.info("--- Resolution Summary ---")
    logger.info("Total files:    %d", result.total_files)
    logger.info("Auto-resolved:  %d", result.auto_resolved)
    logger.info("Flagged:        %d", result.flagged_for_review)
    logger.info("API calls:      %d", result.api_calls_made)
    logger.info("Input tokens:   %d", result.total_input_tokens)
    logger.info("Output tokens:  %d", result.total_output_tokens)

    if result.flagged_for_review > 0:
        logger.warning(
            "%d file(s) require manual review", result.flagged_for_review
        )
        for res in result.resolutions:
            if (
                res.action == "flag_for_review"
                or res.confidence == ConfidenceLevel.LOW
            ):
                logger.warning("  - %s: %s", res.file_path, res.explanation)

    # Compute numeric confidence score (for Jenkins).
    _CONFIDENCE_SCORES = {
        ConfidenceLevel.HIGH: 1.0,
        ConfidenceLevel.MEDIUM: 0.75,
        ConfidenceLevel.LOW: 0.3,
    }
    if result.resolutions:
        scores = [
            _CONFIDENCE_SCORES.get(r.confidence, 0.5) for r in result.resolutions
        ]
        overall_confidence = min(scores)
    else:
        overall_confidence = 1.0

    logger.info("Overall confidence: %.2f", overall_confidence)

    # Write confidence.txt for Jenkins to read.
    output_dir = Path(args.repo) / "sync-output"
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "confidence.txt").write_text(f"{overall_confidence:.2f}")

    # Write PR body if requested.
    if args.output_pr_body:
        from .output import generate_pr_body  # noqa: PLC0415

        upstream_ref = args.upstream_branch
        pr_body = generate_pr_body(result, upstream_ref)

        pr_body_path = Path(args.output_pr_body)
        pr_body_path.parent.mkdir(parents=True, exist_ok=True)
        pr_body_path.write_text(pr_body, encoding="utf-8")
        logger.info("PR body written to %s", args.output_pr_body)

    return 0 if result.flagged_for_review == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
