---
date: 2026-02-02
title: Support For External 2fa Codes
---

## Objective

Enable organizations to enforce a second factor for document signing while keeping delivery fully external (for example customer-owned SMS), with strong recipient/session binding and auditable controls.

## Problem Context

- Many legacy organizations still rely on SMS for second-factor delivery.
- Their users cannot realistically migrate to authenticator apps or passkeys yet.
- Operating first-party SMS infrastructure in Documenso is costly, risky, and outside core scope.
- Customers need an API-first integration path that fits existing notification infrastructure and compliance controls.

## Proposed Solution

Introduce external 2FA codes for signing:

1. A trusted backend service requests a one-time signing token via API.
2. The customer delivers that token to the signer through their own existing channel (for example SMS).
3. The signer enters the token in the signing flow.
4. Documenso validates the submitted token, then issues a short-lived session-bound verification proof.
5. Signature completion is allowed only when the proof is present and valid for that recipient signing session.

## Decisions Captured In Interview

- Enforcement scope: template-level default with per-recipient override.
- Issuer trust boundary: scoped machine API keys with explicit permission.
- Token lifecycle: newest token immediately revokes prior active token for same recipient/document.
- Brute-force control: token-scoped hard attempt cap.
- Security defaults: TTL 10 minutes, max 5 attempts.
- Verification unlock: session-bound proof (not global recipient unlock).
- Issuance contract: idempotent-ish reissue behavior with explicit structured denial reasons.
- Audit privacy: never log token/code material; log identifiers and reason codes only.
- Missing token at signing time: block with actionable state.
- Rollback behavior: feature-flag off for new sessions only.
- Resend/recovery in v1: support-owned reissue guidance only (no signer self-serve trigger).
- Workspace policy controls in v1: no per-workspace TTL/attempt overrides.
- Session proof TTL in v1: 10 minutes.

## Scope

### In Scope

- API endpoint to issue short-lived signing 2FA tokens for eligible recipients.
- Secure storage/verification mechanism (hashed token + expiry + attempt tracking).
- Signing UI step to collect token before signature submission.
- Standard operating flow: token is generated via API and entered by the recipient in the UI.
- Verification endpoint/path integrated into signing completion checks.
- Audit logging for token issuance and verification attempts.
- Template policy defaults with per-recipient override support.
- Session-bound verification proof issuance after successful code validation.
- Feature-flagged rollout controls at workspace/organization scope.

### Out of Scope

- Native SMS sending/providers inside Documenso.
- New authenticator/passkey implementation.
- Cross-channel delivery guarantees (owned by customer infrastructure).
- UI-only token generation as the primary flow in this phase.
- Fully configurable TTL/attempt policy per workspace in v1.
- Customer callback/webhook resend orchestration in v1.
- Signer-triggered self-serve reissue controls in v1.

## Functional Requirements

- Token is recipient-bound and document/session-bound.
- Token cannot be shared across recipients or recipient roles.
- A recipient token only authorizes signature actions for that same recipient identity.
- If the same human is represented by multiple recipient records, each recipient record still requires its own token.
- Token has strict TTL of 10 minutes and single-use semantics.
- Token verification fails on expiry, mismatch, too many attempts, or reuse.
- Endpoint access is restricted to scoped API clients with explicit issuance permission.
- Clear, localized user errors for invalid/expired tokens.
- Max 5 verification attempts per token; on cap reached, token becomes unusable and signer must use a newly issued token.
- Issuing a new token revokes any existing active token for the same recipient/document pair.
- Successful verification creates a short-lived session-bound proof; only that session can complete signature.
- If 2FA is required but no valid token has been issued yet, signing must be blocked with actionable guidance.

## Non-Functional Requirements

- Verification and consumption path must be atomic and race-safe under concurrent requests.
- Error responses must use stable machine-readable reason codes for customer integrations.
- p95 verification latency should remain within existing signing guardrail budget (target: <= 300 ms server-side).
- Security controls and audit logging must not expose token/code values in logs, traces, or analytics payloads.

## Policy Model

- Default requirement is configured at template/workflow level.
- Sender can override requirement per recipient before send.
- Effective policy is materialized on recipient/document at send time to avoid template drift during in-flight signing.
- Feature flag gates enforcement by workspace/organization for rollout and rollback.

## API Contract

### Token Issuance Endpoint

- Auth: scoped API key with dedicated permission (for example `signing_2fa:issue`).
- Input: recipient/document context and optional idempotency metadata.
- Behavior:
  - Eligible recipient: always issues a fresh token and revokes prior active token.
  - Ineligible/forbidden state: returns structured 4xx with explicit reason code.
  - Never returns previously generated plaintext token; token is visible exactly once at issuance.
- Output:
  - Plaintext token (single response only).
  - Metadata for integration handling (expiresAt, ttlSeconds, attemptLimit, issuedAt).

### Verification Endpoint

- Input: token submission from signing UI bound to current signing session context.
- Behavior:
  - Valid token: atomically consumes token and issues session-bound verification proof.
  - Invalid token: increments attempts and returns reason code.
  - Expired/revoked/consumed/capped: returns denial reason without revealing sensitive internals.
- Output:
  - Success: verification state for current session.
  - Failure: localized user-safe message + machine reason code.

### Resend/Reissue Behavior (v1)

- No signer-triggered callback/webhook or self-serve reissue endpoint in v1.
- If token is missing/expired/revoked/capped, signer sees actionable guidance to contact sender/support.
- Reissue remains an API-key-initiated operation from trusted customer backend only.

### Suggested Reason Codes

- `TWO_FA_NOT_REQUIRED`
- `TWO_FA_NOT_ISSUED`
- `TWO_FA_TOKEN_INVALID`
- `TWO_FA_TOKEN_EXPIRED`
- `TWO_FA_TOKEN_REVOKED`
- `TWO_FA_TOKEN_CONSUMED`
- `TWO_FA_ATTEMPT_LIMIT_REACHED`
- `TWO_FA_ISSUER_FORBIDDEN`
- `TWO_FA_RECIPIENT_INELIGIBLE`

## Data Model

Create `signing_two_factor_tokens` (name indicative):

- `id`
- `recipientId`
- `documentId`
- `tokenHash`
- `tokenSalt` (or use KDF settings sufficient to avoid raw-secret recovery)
- `expiresAt`
- `consumedAt` nullable
- `revokedAt` nullable
- `attempts` default 0
- `attemptLimit` default 5
- `issuedByApiKeyId` (or actor reference)
- `createdAt`

Optional companion table/entity for session proof:

- `signing_session_2fa_proofs`
- `sessionId`
- `recipientId`
- `documentId`
- `verifiedAt`
- `expiresAt`

Constraints and indexes:

- Index on (`recipientId`, `documentId`, `expiresAt`).
- At most one active token per (`recipientId`, `documentId`) enforced by transactional revoke-on-issue.
- Guard against lost-update on attempts and consume via row lock or atomic update conditions.

## Signing UX

- Insert 2FA code step before signature commit when effective policy requires it.
- UX states:
  - Waiting for code input.
  - Invalid code (remaining attempts shown where safe).
  - Expired/revoked/attempt cap reached with clear next-step copy.
  - Not issued yet state with actionable guidance.
- Recovery copy in v1 must direct signer to sender/support (no in-product resend action).
- Localization required for all user-facing errors.
- Accessibility: input labeling, error announcement, keyboard submission, mobile-friendly numeric entry.
- Session-bound proof behavior must be transparent to user (no global unlock across devices/tabs).

## Security Requirements

- Never persist plaintext token; store salted hash only.
- Rate-limit issuance and verification attempts.
- Invalidate previous active token immediately when a new token is issued.
- Emit security/audit events with actor, recipient, document, timestamp, and reason codes.
- Prevent token leakage in logs, telemetry, and error payloads.
- Use constant-time comparison and hardened random token generation.
- Enforce short proof lifetime for verified session to reduce replay window.
- Set proof TTL to 10 minutes in v1.

## Observability And Audit

Emit events for:

- `2fa_token_issued`
- `2fa_token_issue_denied`
- `2fa_token_verify_succeeded`
- `2fa_token_verify_failed`
- `2fa_token_consumed`
- `2fa_token_revoked`

Event fields:

- `workspaceId`, `documentId`, `recipientId`
- `actorType` (api_key, signer_session, system)
- `actorId` (where applicable)
- `reasonCode`
- `ipHash`, `userAgentHash` (if available)
- `timestamp`

Metrics and alerts:

- Issuance success/failure rates.
- Verification success/failure rate split by reason code.
- Attempt-limit-hit rate.
- p95 verification latency.
- Alert on unusual spikes in invalid attempts per recipient/document/workspace.

## Implementation Plan

1. Domain model
   - Add signing 2FA token entity/table and session-proof persistence.
2. Token issuance API
   - Add authenticated route for scoped API keys; issue fresh token, revoke prior active.
3. Verification logic
   - Validate token state, increment attempts atomically, consume on success, mint session proof.
4. Signing flow integration
   - Add UI token prompt and backend guard requiring valid session proof.
5. Observability
   - Add reason-coded events and dashboards/alerts.
6. Controls
   - Add rate limits, attempt cap (5), revoke-on-reissue, and feature flag checks.
7. Testing
   - Unit tests for generation/verification edge cases.
   - Integration tests for API and signing flow.
   - Concurrency tests for double-submit and parallel verification.

## Testing Matrix

- Token issuance for eligible/ineligible recipients.
- Reissue revokes previous token immediately.
- Verification success path creates session-bound proof.
- Verification fails on mismatch, expiry, revoked, consumed, cap reached.
- Attempt counter increments correctly under concurrent requests.
- Signature blocked when proof absent or expired.
- Recipient A token rejected for recipient B (including same human/multiple recipient records).
- Feature flag off: new sessions bypass external 2FA requirement.
- Audit events emitted with expected reason codes and no token material.

## Acceptance Criteria

- External system can request a token for an eligible signer through API.
- Signer cannot complete signing without valid token when policy requires 2FA.
- A token issued for recipient A is always rejected for recipient B, including when both recipients map to the same underlying person.
- Valid token allows signing exactly once within TTL.
- Expired/reused/invalid tokens are rejected with clear errors.
- No Documenso-owned SMS infrastructure is introduced.
- Audit trail captures issuance and verification outcomes.
- Default policy can be set at template level with per-recipient override at send time.
- New token issuance revokes prior active token for same recipient/document.
- Max 5 failed attempts per token is enforced.
- Successful verification unlocks only the active signing session.
- If no token has been issued yet, signer is blocked with actionable guidance.

## Rollout Strategy

- Ship behind feature flag (workspace-level or organization-level).
- Enable first for pilot customers in regulated domains.
- Monitor verification failure rates and support feedback.
- Gradually expand availability once stable.
- Rollback path: disable flag for new sessions only; preserve already verified in-flight sessions.

## Risks and Mitigations

- Brute-force attempts -> enforce attempt caps, lockouts, and rate limits.
- Delivery delays in customer SMS systems -> allow controlled token re-issue.
- Support burden from expiry confusion -> clear UX copy and resend guidance.
- Concurrency race on consume/attempt updates -> use transactional atomic updates and dedicated tests.
- Misconfigured API clients -> explicit permission scopes and structured denial reasons.
- Forensic gaps vs privacy over-collection -> reason-coded audits with hashed network metadata only.

## Open Questions

- None for v1 scope.
- v1.1 exploration candidate: customer-controlled signer-triggered callback/reissue flow with abuse protections.
