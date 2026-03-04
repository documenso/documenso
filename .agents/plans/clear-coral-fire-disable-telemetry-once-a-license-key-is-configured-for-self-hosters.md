---
date: 2026-03-04
title: Disable Telemetry Once A License Key Is Configured For Self Hosters
---

## Goal

Automatically disable self-host telemetry when a license key is configured, while preserving explicit telemetry kill-switch behavior and minimizing behavior changes for unlicensed installs.

## Decisions Captured In Interview

- Disable telemetry based on license key presence (after trim), regardless of key validity/expiry/reachability.
- No force-enable override for licensed installs.
- `DOCUMENSO_DISABLE_TELEMETRY` remains highest-priority explicit disable switch.
- Startup logs should include only a concise reason for skip (no key metadata).
- Startup-only evaluation model (env changes require restart).
- No new runtime self-host detection signal; use license key presence as the practical proxy and document this as self-host-focused behavior (especially official Docker deployments).
- Roll out immediately (no warning-only transition release).

## Current State

- Telemetry startup gate in `apps/remix/server/router.ts` calls `TelemetryClient.start()` in non-dev.
- `TelemetryClient.start()` in `packages/lib/server-only/telemetry/telemetry-client.ts` only checks:
  - `DOCUMENSO_DISABLE_TELEMETRY`
  - telemetry credentials (`NEXT_PRIVATE_TELEMETRY_KEY`, `NEXT_PRIVATE_TELEMETRY_HOST`)
- License key presence is read separately in `packages/lib/server-only/license/license-client.ts` via `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY`.

## Desired Behavior

At startup, telemetry enablement decision must be deterministic and follow this order:

1. If `DOCUMENSO_DISABLE_TELEMETRY` is set to `true`, telemetry is disabled.
2. Else if `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY?.trim()` is non-empty, telemetry is disabled.
3. Else if telemetry credentials are missing, telemetry is disabled.
4. Else telemetry is enabled.

Notes:

- License key does not need to be validated to disable telemetry.
- The decision is evaluated once during startup.
- Behavior is documented as intended for self-hosted/license-bearing deployments; no additional environment discriminator is introduced.

## Plan

1. Centralize startup decision in telemetry module
   - Add a pure helper in `packages/lib/server-only/telemetry/telemetry-client.ts` (or sibling util) that returns both:
     - `shouldStart: boolean`
     - `reason: 'disabled_by_env' | 'disabled_by_license_key' | 'missing_credentials' | 'enabled'`
   - Parse env values in helper input (string-based) and apply trim to license key before decisioning.
   - Keep no-op semantics in `TelemetryClient.start()` when `shouldStart` is false.

2. Wire helper into `TelemetryClient.start()`
   - Replace ad-hoc inline checks with the helper.
   - Preserve existing singleton and init flow when enabled.
   - Emit a single startup log line for disabled reasons:
     - `disabled_by_env`: existing disable message can remain.
     - `disabled_by_license_key`: new concise line that telemetry is skipped because a license key is configured.
     - `missing_credentials`: existing credentials-missing message can remain.
   - Do not include key values, lengths, or verification details in logs.

3. Keep startup-only semantics explicit
   - No dynamic re-evaluation and no runtime toggling.
   - Document that env changes (including license key) require process restart.

4. Test the decision matrix thoroughly
   - Add/extend unit tests for the helper to cover:
     - `DOCUMENSO_DISABLE_TELEMETRY=true` + creds + license key => disabled (`disabled_by_env`)
     - license key present (trimmed non-empty) + creds + no disable flag => disabled (`disabled_by_license_key`)
     - license key whitespace-only + creds => enabled
     - no license + missing key/host credential => disabled (`missing_credentials`)
     - no license + creds => enabled
   - Include edge parsing assertions:
     - undefined/null/empty/whitespace values
     - only exact string `"true"` disables telemetry via `DOCUMENSO_DISABLE_TELEMETRY`; other non-empty values like `"false"` or `"1"` do not disable

5. Update docs and rollout notes
   - Update:
     - `apps/docs/content/docs/self-hosting/configuration/telemetry.mdx`
     - `apps/docs/content/docs/self-hosting/configuration/environment.mdx`
   - State clearly:
     - telemetry auto-disables when `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` is configured
     - `DOCUMENSO_DISABLE_TELEMETRY` is still supported and takes precedence
     - restart required after env changes
   - Roll out immediately; mention behavior change in release notes/changelog.

## Implementation Notes

- Prefer reading env values at decision time inside `start()` or through helper parameters to keep unit tests deterministic and avoid module-load caching pitfalls.
- Keep helper pure (no logging, no side effects) so tests only assert decision outputs.
- Logging should happen in `start()` based on helper reason.

## Acceptance Criteria

- With `NEXT_PRIVATE_DOCUMENSO_LICENSE_KEY` set, telemetry client never initializes or sends events.
- This remains true even if the license key is invalid, expired, or license-server lookup fails.
- Existing unlicensed self-host behavior unchanged.
- `DOCUMENSO_DISABLE_TELEMETRY=true` still disables telemetry regardless of license state.
- Docs reflect new auto-disable behavior.
- No force-enable override is introduced.
- Startup logs show clear skip reason without exposing license metadata.

## Risks

- Env parsing mismatch (whitespace/empty string) could misclassify licensed state.
- Logging changes may affect existing startup log assertions.
- If some non-self-hosted/internal deployments set license key for unrelated reasons, telemetry will now be disabled there too (accepted tradeoff due to no extra self-host signal).

## Failure Modes And Recovery

- Misconfiguration (accidental license key set) causes unexpected telemetry disable:
  - Recovery: unset key and restart process.
- Missing telemetry credentials in unlicensed deployments keeps telemetry off:
  - Recovery: set both telemetry env vars and restart.
- Regression in gating logic:
  - Recovery: revert to previous `TelemetryClient.start()` guard behavior and redeploy.

## Verification Plan

- Run telemetry helper unit tests.
- Run typecheck for touched package(s).
- Manual smoke verification in startup logs for:
  - unlicensed + credentials => telemetry enabled logs
  - licensed + credentials => telemetry skipped (license reason)
  - explicit disable env => telemetry skipped (disable-env reason)

## Rollback Plan

- Revert telemetry decision helper integration commit.
- Redeploy and verify startup logs return to previous behavior.
- Keep docs/changelog in sync with rollback if reverted after release.

## Implementation Tickets

1. Telemetry gating helper + startup integration
   - Scope: `packages/lib/server-only/telemetry/telemetry-client.ts`
   - Deliverables: pure decision helper, reason enum, startup log routing, no behavior drift outside gating order.
   - Validation: helper unit tests green, existing telemetry start path unchanged when enabled.
   - Complexity: M

2. Test matrix hardening
   - Scope: telemetry helper test file(s) in `packages/lib/server-only/telemetry/`
   - Deliverables: full matrix for disable env, license key (trimmed), missing credentials, enabled case, edge parsing.
   - Validation: deterministic tests with no module-load env leakage.
   - Complexity: S

3. Docs + release note update
   - Scope: `apps/docs/content/docs/self-hosting/configuration/telemetry.mdx`, `apps/docs/content/docs/self-hosting/configuration/environment.mdx`, release notes/changelog target.
   - Deliverables: updated behavior docs, precedence order, restart requirement, rollout note.
   - Validation: docs reflect implemented gating order exactly.
   - Complexity: S

## Unresolved Questions

- None.
