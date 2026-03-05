---
date: 2026-03-02
title: View Pdf As Recipient Online After Completion Via Qr Share Url Outside Team
---

## Goal

Allow a recipient (including users outside the owning team) to open the final completed PDF online from the post-completion experience.

## Non-Goals

- No support for historical completed documents that predate this change.
- No recipient access to draft versions, intermediate revisions, or team-internal metadata.
- No rollout flag/canary; ship enabled by default.

## Current State

Only sender/team-member paths reliably reach the online PDF viewer. Recipient-side access after signing can fail when authorization assumes team membership.

## Product Decisions Captured

- Authorization primitive: signed recipient token (recipient + document scoped).
- URL availability: generate and persist synchronously before showing completion CTA.
- Revocation: inherit existing document share/QR toggle behavior.
- Security controls in v1: access logs plus per-token + IP rate limiting.
- Token binding strictness: recipient + document binding only (no device/IP hard binding).
- Artifact visibility: final completed PDF only.
- Backward compatibility: only new completions are supported.
- Multi-recipient policy: recipient can view only after whole document is fully completed.
- Failure UX: inline retry with backoff and support code.
- Rollout: enabled globally by default.

## Detailed Plan

1. Trace and reuse the existing QR/share URL generation source for completed documents.
2. Ensure share URL/token material is created transactionally in the completion finalization flow, before completion CTA rendering.
3. Wire recipient post-completion CTA to this shared URL source (not team-member viewer route assumptions).
4. Add a dedicated authorization path for recipient online-view requests:
   - Validate signed token.
   - Confirm token recipientId matches a recipient on the target document.
   - Confirm token documentId matches request document.
   - Confirm document status is fully completed.
   - Confirm share/QR access is currently enabled.
5. Keep sender behavior unchanged; sender paths continue through existing sender/team rules.
6. Add fallback UX for missing/failed share URL generation with bounded retry and support code.
7. Add observability and abuse controls (logs, rate limits) on recipient view endpoint.
8. Add and update automated tests for happy path and denial path coverage.

## Authorization and Security Model

### Access Contract

- Recipient view endpoint accepts a signed recipient token (bearer).
- Token claims should include at minimum:
  - `documentId`
  - `recipientId`
  - `completedAt` (or equivalent anti-stale marker)
  - `exp` (bounded expiry)
- Team membership is not required for this path.

### Access Denial Conditions

- Invalid signature, expired token, or malformed claims.
- Token/document mismatch or token/recipient mismatch.
- Document not fully completed.
- Share/QR feature disabled/revoked for document.
- Rate limit exceeded.

### Rate Limiting

- Apply sliding window limits keyed by token fingerprint + source IP.
- Return `429` with `Retry-After` on throttle.
- Log throttle events with reason and correlation id.

### Audit Logging

- Log recipient view attempts (allow + deny) with:
  - document id
  - recipient id (if resolvable)
  - result (allow/deny)
  - deny reason code
  - IP and user-agent
  - request correlation id

## UX and Behavior

### Post-Completion CTA

- Completion screen includes `View completed PDF` CTA for recipients.
- CTA is rendered only after synchronous URL generation succeeds.

### Failure Handling

- If synchronous generation fails, keep user on completion success context and show:
  - clear inline error
  - retry action with exponential backoff (bounded attempts)
  - support code/correlation id for escalation
- Do not expose internal stack details.

### Multi-Recipient Behavior

- Recipient access is blocked until all required recipients are completed and document is in final completed state.

## Data and Lifecycle

- Reuse existing share URL persistence model.
- Generate token/share material during completion finalization for new completions only.
- No retroactive migration for previously completed documents.

## API / Endpoint Expectations

- Recipient viewer endpoint should return:
  - `200` with final PDF viewer payload on success
  - `401/403` for token/authz failures (reason mapped to safe frontend message)
  - `404` if document is not visible via token context
  - `409` if document not yet fully completed
  - `429` when rate-limited
- Error responses should expose stable error codes consumable by frontend copy mapping.

## Testing Strategy

### Unit / Integration

- Token validation and claim mismatch rejection.
- Denial when document incomplete.
- Denial when share toggle disabled.
- Rate-limit enforcement behavior.

### End-to-End

- Sender path unaffected (regression).
- Recipient outside team can open final PDF after full completion.
- Recipient cannot open before full completion.
- Unauthorized/random user without valid token is denied.
- Failure fallback UI shows retry + support code on forced generation failure.

## Validation Criteria

- Recipient can open completed PDF online from completion context without team membership.
- Final-PDF-only visibility is enforced.
- Sender behavior remains unchanged.
- Unauthorized users still cannot access the document.
- Share-toggle revocation immediately removes recipient access.
- Access events and rate-limit events are observable in logs.

## Risks and Mitigations

- Risk: broader access than intended.
  - Mitigation: strict recipient+document token checks, completed-state check, share-toggle gate.
- Risk: completion-time URL generation increases latency.
  - Mitigation: keep generation in bounded transaction path, add retry fallback UX, log latency.
- Risk: support confusion for pre-existing completed documents.
  - Mitigation: document "new completions only" behavior in release notes/internal support docs.

## Implementation Checklist (Repo-Mapped)

1. Completion UX entry point (recipient side)
   - File: `apps/remix/app/routes/_recipient+/sign.$token+/complete.tsx`
   - Replace/augment current post-completion action so recipients get a direct `View completed PDF` action that points to `/share/${document.qrToken}` when available.
   - Gate visibility on final completion state (`signingStatus === 'COMPLETED'`) and `document.qrToken` presence.
   - Keep download and existing sender/home actions unchanged.

2. Ensure QR token availability at completion time
   - File: `packages/lib/jobs/definitions/internal/seal-document.handler.ts`
   - Preserve existing `qrToken` creation in sealing flow and confirm it runs before the recipient completion page can surface the final view action.
   - If race conditions appear (status completed but `qrToken` missing), add an explicit short polling/fallback state in UI rather than exposing a broken link.

3. Recipient-readable completed document route
   - File: `apps/remix/app/routes/_share+/share.$slug.tsx`
   - Keep `qr_` branch as the recipient-safe online view path and ensure it stays independent from team membership checks.
   - Keep non-`qr_` slug behavior (social share redirects/meta) unchanged.

4. Access/read model for QR token
   - File: `packages/lib/server-only/document/get-document-by-access-token.ts`
   - Maintain strict completed-document-only lookup (`status: COMPLETED`) and minimal selected payload.
   - Verify returned payload remains final-artifact-only (no draft/intermediate data leakage).

5. Existing share-link path boundary (non-goal guardrail)
   - Files: `packages/trpc/server/document-router/share-document.ts`, `packages/lib/server-only/share/create-or-get-share-link.ts`
   - Do not repurpose social `DocumentShareLink` as authorization source for final PDF access in this change.
   - Keep this as a separate concern from QR token completed-document viewing.

6. Logging and throttling hooks
   - Files: `apps/remix/server/router.ts`, `packages/lib/server-only/rate-limit/rate-limit.ts`, `packages/lib/server-only/rate-limit/rate-limit-middleware.ts`
   - Add or reuse per-route limits for `/share/qr_*` access attempts.
   - Log allow/deny/throttle events with correlation id to support abuse triage.

7. Test coverage targets
   - Add route/component coverage for recipient completion page behavior in `apps/remix/app/routes/_recipient+/sign.$token+/complete.tsx` flows.
   - Add integration coverage for QR route access in `apps/remix/app/routes/_share+/share.$slug.tsx` + `packages/lib/server-only/document/get-document-by-access-token.ts`.
   - Add E2E scenario under `packages/app-tests/e2e/document-auth/` for:
     - recipient outside team sees and uses `View completed PDF` after full completion,
     - recipient does not see final-view action before full completion,
     - invalid/random QR token is denied.

8. Verification commands
   - Typecheck changed TS packages: `npx tsc --noEmit`
   - Run affected tests (targeted): `npm run test:dev -w @documenso/app-tests`
   - Optional broader confidence (if needed): `npm run lint`
