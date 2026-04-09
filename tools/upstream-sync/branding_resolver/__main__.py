"""CLI entrypoint for the branding conflict resolver.

Usage:
    python -m branding_resolver --repo . --dry-run --verbose
    python -m branding_resolver --repo . --tier2-model claude-sonnet-4-20250514 --enable-tsc
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from .config import BrandingConfig
from .confidence import ConfidenceLevel
from .model_client import ModelTier

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

    # Tiered model configuration.
    parser.add_argument(
        "--tier1-model",
        default=None,
        help="Tier 1 model (fast/cheap). Default: from env OPENROUTER_MODEL or google/gemini-3-flash-preview",
    )
    parser.add_argument(
        "--tier2-model",
        default=None,
        help="Tier 2 model via OpenRouter (capable). Default: anthropic/claude-sonnet-4. Set to empty to disable.",
    )
    parser.add_argument(
        "--tier3-model",
        default=None,
        help="Tier 3 model via OpenRouter (strongest). Default: anthropic/claude-opus-4. Set to empty to disable.",
    )
    parser.add_argument(
        "--max-repair-rounds",
        type=int,
        default=3,
        help="Maximum repair rounds per file (0-3, default: 3)",
    )
    parser.add_argument(
        "--enable-tsc",
        action="store_true",
        help="Run TypeScript validation (tsc --noEmit) in Docker after resolution",
    )
    parser.add_argument(
        "--cache-db",
        type=str,
        default=None,
        help="Path to SQLite resolution cache DB. Set to enable caching.",
    )

    return parser


def _build_tiers(args: argparse.Namespace, config: BrandingConfig) -> list[ModelTier]:
    """Build model tiers from CLI args and environment.

    All tiers use OpenRouter as the provider — it can proxy Gemini, Claude,
    and other models through a single API key.
    """
    tiers: list[ModelTier] = []

    openrouter_key = config.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
    if not openrouter_key:
        logger.warning("No OPENROUTER_API_KEY set — LLM resolution will fail")

    # Tier 1: Fast/cheap model (Gemini Flash).
    tier1_model = args.tier1_model or config.openrouter_model or os.environ.get(
        "OPENROUTER_MODEL", "google/gemini-3-flash-preview"
    )
    tiers.append(ModelTier(
        name="tier1", provider="openrouter",
        model=tier1_model, api_key=openrouter_key,
    ))

    # Tier 2: Capable model (Claude Sonnet) via OpenRouter.
    tier2_model = args.tier2_model if args.tier2_model is not None else "anthropic/claude-sonnet-4"
    if tier2_model:
        tiers.append(ModelTier(
            name="tier2", provider="openrouter",
            model=tier2_model, api_key=openrouter_key,
        ))

    # Tier 3: Strongest model (Claude Opus) via OpenRouter.
    tier3_model = args.tier3_model if args.tier3_model is not None else "anthropic/claude-opus-4"
    if tier3_model:
        tiers.append(ModelTier(
            name="tier3", provider="openrouter",
            model=tier3_model, api_key=openrouter_key,
        ))

    return tiers


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

    logger.info("Branding conflict resolver v2 starting")
    logger.info("Repo: %s", args.repo)
    logger.info("Our branch: %s", args.our_branch)
    logger.info("Upstream branch: %s", args.upstream_branch)

    config = BrandingConfig()
    tiers = _build_tiers(args, config)
    logger.info("Model tiers: %s", [f"{t.name}={t.model}" for t in tiers])

    # Optional resolution cache.
    cache = None
    if args.cache_db:
        from .resolution_cache import ResolutionCache  # noqa: PLC0415
        cache = ResolutionCache(db_path=Path(args.cache_db))
        cache.clear_expired()
        logger.info("Resolution cache enabled at %s", args.cache_db)

    from .resolver import BrandingResolver  # noqa: PLC0415

    resolver = BrandingResolver(
        repo_path=args.repo,
        config=config,
        tiers=tiers,
        dry_run=args.dry_run,
        max_repair_rounds=args.max_repair_rounds,
        cache=cache,
        enable_tsc=args.enable_tsc,
    )

    result = resolver.resolve_merge(
        our_branch=args.our_branch,
        upstream_branch=args.upstream_branch,
    )

    # Close cache if open.
    if cache:
        cache.close()

    # Print summary.
    logger.info("--- Resolution Summary ---")
    logger.info("Total files:      %d", result.total_files)
    logger.info("Auto-resolved:    %d", result.auto_resolved)
    logger.info("Flagged:          %d", result.flagged_for_review)
    logger.info("Unresolvable:     %d", len(result.unresolvable_files))
    logger.info("API calls:        %d", result.api_calls_made)
    logger.info("Input tokens:     %d", result.total_input_tokens)
    logger.info("Output tokens:    %d", result.total_output_tokens)
    logger.info("Cost (USD):       $%.4f", result.total_cost_usd)
    logger.info("Tier stats:       %s", dict(result.tier_stats))
    logger.info("Repair stats:     %s", dict(result.repair_stats))

    if result.unresolvable_files:
        logger.warning(
            "%d file(s) are UNRESOLVABLE:", len(result.unresolvable_files)
        )
        for f in result.unresolvable_files:
            logger.warning("  - %s", f)

    if result.flagged_for_review > 0:
        logger.warning(
            "%d file(s) require review:", result.flagged_for_review
        )
        for res in result.resolutions:
            if (
                res.action == "flag_for_review"
                or res.confidence == ConfidenceLevel.LOW
            ):
                logger.warning("  - %s: %s", res.file_path, res.explanation)

    # Compute informational confidence score (backward compat).
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

    logger.info("Overall confidence: %.2f (informational only)", overall_confidence)

    # Write output files.
    output_dir = Path(args.repo) / "sync-output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # confidence.txt (backward compat).
    (output_dir / "confidence.txt").write_text(f"{overall_confidence:.2f}")

    # unresolvable_files.txt (the merge gate).
    (output_dir / "unresolvable_files.txt").write_text(
        "\n".join(result.unresolvable_files)
    )

    # resolution_report.json (full analytics).
    report = {
        "total_files": result.total_files,
        "auto_resolved": result.auto_resolved,
        "flagged_for_review": result.flagged_for_review,
        "unresolvable": result.unresolvable_files,
        "api_calls": result.api_calls_made,
        "input_tokens": result.total_input_tokens,
        "output_tokens": result.total_output_tokens,
        "tier_stats": dict(result.tier_stats),
        "repair_stats": dict(result.repair_stats),
        "cost_usd": result.total_cost_usd,
        "confidence": overall_confidence,
        "resolutions": [
            {
                "file": r.file_path,
                "category": r.category,
                "action": r.action,
                "confidence": r.confidence.value,
                "tier": r.tier_used,
                "repair_round": r.repair_round,
                "errors": r.validation_errors,
                "explanation": r.explanation[:200],
            }
            for r in result.resolutions
        ],
    }
    (output_dir / "resolution_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )

    # flagged_reviews.json for PR inline comments.
    flagged = []
    for res in result.resolutions:
        if res.action == "flag_for_review":
            line = 1
            if res.content:
                for i, content_line in enumerate(res.content.splitlines(), 1):
                    if content_line.startswith("<<<<<<<"):
                        line = i
                        break
            flagged.append({
                "path": res.file_path,
                "line": line,
                "body": f"**Flagged for manual review**\n\n{res.explanation}",
            })
    (output_dir / "flagged_reviews.json").write_text(
        json.dumps(flagged, indent=2), encoding="utf-8"
    )

    # Write PR body if requested.
    if args.output_pr_body:
        from .output import generate_pr_body  # noqa: PLC0415

        upstream_ref = args.upstream_branch
        pr_body = generate_pr_body(result, upstream_ref)

        pr_body_path = Path(args.output_pr_body)
        pr_body_path.parent.mkdir(parents=True, exist_ok=True)
        pr_body_path.write_text(pr_body, encoding="utf-8")
        logger.info("PR body written to %s", args.output_pr_body)

    # Exit codes: 0=all resolved, 1=unresolvable files exist, 2=fatal error
    if result.unresolvable_files:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
