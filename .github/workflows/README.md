# GitHub Workflows

This fork ships the full upstream `documenso/documenso` workflow set plus a fork-specific AWS deploy workflow. Workflows that target upstream-only infrastructure are guarded with `if: github.repository == 'documenso/documenso'` so they skip cleanly in forks — the green/red status badge stays accurate.

## Fork-owned workflows

| Workflow | Purpose | Triggers | Required config |
|----------|---------|----------|-----------------|
| `deploy-aws.yml` | Build + push image to ECR, roll ECS service | push to `main`, `workflow_dispatch` | Repo vars: `AWS_ACCOUNT_ID`, `AWS_REGION`, `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_SERVICE`. Repo secret: `AWS_DEPLOY_ROLE_ARN`. Forks without these skip via the `guard` job — no red X. |

## Upstream-gated workflows (skip in forks)

These run only when `github.repository == 'documenso/documenso'`:

- `deploy.yml` — push tags to release branch (upstream release process)
- `publish.yml` — publish Docker images to upstream's Docker Hub org (uses Warp runners)
- `translations-pull.yml`, `translations-upload.yml`, `translations-force-pull.yml` — Crowdin sync, requires secrets in upstream's `Translations` environment
- `e2e-tests.yml` — Playwright tests on a Warp runner. Forks can opt in by setting repo variable `ENABLE_E2E_TESTS=true` and providing a compatible runner.

## Upstream-agnostic workflows (always run)

These work out of the box in forks with no config:

- `ci.yml` — lint, typecheck, unit tests
- `codeql-analysis.yml` — security scanning
- `semantic-pull-requests.yml` — PR title validation
- `stale.yml` — mark stale issues
- `pr-labeler.yml`, `issue-labeler.yml`, `issue-opened.yml`, `first-interaction.yml`, `issue-assignee-check.yml`, `pr-review-reminder.yml` — issue/PR hygiene

## Enabling a skipped workflow in a fork

Add the required secrets/variables in **Settings → Secrets and variables → Actions** and remove the `if: github.repository == '...'` guard (or set the matching opt-in variable where one exists, e.g. `ENABLE_E2E_TESTS=true`).
