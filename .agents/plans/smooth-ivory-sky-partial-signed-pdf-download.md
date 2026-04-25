---
date: 2026-04-22
title: Partial Signed Pdf Download
---

## Context

External API / embed-iframe consumers need to return a usable signed PDF to a recipient immediately after that recipient completes their signature, even when other recipients are still pending. Today, `GET /api/v2/envelope/item/{id}/download?version=signed` silently returns the original unsigned PDF while the envelope is `PENDING` — the real signed PDF only materialises after the last recipient signs and the `seal-document` job runs. Impact: no way for an internal signer (who signed first) to verify their signature was captured until the whole envelope completes.

Goal: add a third download variant `version=pending` that, during envelope status `PENDING`, returns the original PDF with all currently-inserted fields burned in, marked as a non-final draft.

## Scope

- API-only. No internal UI / "View" button wiring.
- v2 API only (no v1).
- `internalVersion === 2` envelopes only.

## Decisions

| # | Decision |
|---|---|
| 1 | Extend existing endpoint: add `'pending'` to `version` enum on `GET /envelope/item/{envelopeItemId}/download` |
| 2 | Add sibling recipient-token route: `GET /api/v2/sign/{token}/envelope-item/{envelopeItemId}/download?version=pending` |
| 3 | Allowed envelope status for `version=pending`: `PENDING` only — else 400 (distinct AppError codes per status, single HTTP 400) |
| 4 | Legacy `internalVersion === 1` envelopes: 501 Not Implemented |
| 5 | Recipient-token path: allowed only after that recipient's `signingStatus === SIGNED` or `signingStatus === REJECTED`; otherwise 403 |
| 6 | Same content for all authorized callers (API token vs recipient token). No per-caller field filtering |
| 7 | Burn fields where `inserted === true` across all recipients. Exact parity with `seal-document` (same `FieldWithSignature` prisma include) |
| 8 | **No PKI signing** (`signPdf` skipped) |
| 9 | **No certificate / no audit log** appendix pages |
| 10 | **No audit log entry** on download (matches no-cert decision); structured log/metric only |
| 11 | Watermark: diagonal watermark across entire page 1 + footer line on every page. Banner text: `"DRAFT — Not a final executed document. Awaiting {N} more signature(s). Envelope {envelopeId} · {ISO-UTC timestamp}"`. English only, correct pluralization (drop "(s)" when N=1 / use "signature" vs "signatures"). `N` = recipients whose `signingStatus !== SIGNED` excluding `role === ASSISTANT` and `role === CC` |
| 12 | Zero-inserted-fields case: still return original + banner/watermark (never 404). Banner renders on every item in envelope regardless of whether that item has inserted fields |
| 13 | Assistant-inserted fields ARE burned in; Assistant role is not counted in `N` |
| 14 | Content-addressed ETag: `sha256(envelope.status + recipient count + sorted((field.id, field.customText, field.Signature?.id, field.updatedAt) for inserted===true fields on this envelopeItemId))`. Return `304 Not Modified` on `If-None-Match` match. On miss, generate fresh PDF, set `ETag`, `Cache-Control: no-store, private` |
| 15 | Generation: on-demand each request when ETag misses, no persistent cache |
| 16 | Do not persist a new `DocumentData` / do not mutate `EnvelopeItem.documentDataId` |
| 17 | Error body shape for 400/501/403: AppError JSON `{code, message, status}` consistent with other v2 API errors. SHA-256 of response bytes returned as `ETag` header also usable by callers for integrity check |
| 18 | Filename on download: `{title}-draft.pdf` |

## Files to Modify

### 1. `apps/remix/server/api/download/download.types.ts`
Extend Hono validator: add `'pending'` to the `version` enum on `ZDownloadEnvelopeItemRequestParamsSchema`. (Document-level schema unchanged.)

### 2. `packages/trpc/server/envelope-router/download-envelope-item.types.ts`
Extend OpenAPI-facing `ZDownloadEnvelopeItemRequestSchema.version` enum with `'pending'` so the public schema/docs match. Update `.describe(...)`.

### 3. `apps/remix/server/api/files/files.helpers.ts`
Keep `handleEnvelopeItemFileRequest` shape unchanged. Add a sibling function `handlePartialEnvelopeItemFileRequest` invoked when `version === 'pending'`:
- Guard: `envelope.status !== PENDING` → `AppError` (distinct code per status: `ENVELOPE_DRAFT`, `ENVELOPE_COMPLETED`, `ENVELOPE_REJECTED`, `ENVELOPE_VOIDED`), HTTP 400.
- Guard: `envelope.internalVersion !== 2` → `AppError(NOT_IMPLEMENTED)` 501.
- Compute content-addressed ETag (see Decision 14). If `If-None-Match` matches → 304.
- Load original PDF bytes via `getFileServerSide({ type, data: documentData.initialData })`.
- Load fields with `FieldWithSignature` include (mirror the query in `seal-document.handler.ts`), filter `inserted === true`.
- Compute `N` (see Decision 11).
- Call new helper `generatePartialSignedPdf` (below).
- Set headers: `Content-Type: application/pdf`, `Cache-Control: no-store, private`, `ETag: <computed>`.
- On download: `Content-Disposition` filename `{baseTitle}-draft.pdf`.
- Return bytes.

### 4. API route: `apps/remix/server/api/download/download.ts` (or wherever the existing `/envelope/item/{id}/download` handler lives)
Branch on `version`. For `'pending'` call the new handler above.

### 5. NEW sibling route for recipient-token path: `apps/remix/server/api/sign/*`
Pattern: `GET /api/v2/sign/{token}/envelope-item/{envelopeItemId}/download?version=pending`.
- Resolve recipient by token (reuse existing token lookup used by signing routes).
- Authorize envelopeItemId belongs to that envelope.
- Enforce Decision 5 (`signingStatus` must be `SIGNED` or `REJECTED`).
- Delegate to the same `handlePartialEnvelopeItemFileRequest`.
- Only `version=pending` is supported on this route (reject other versions with 400). This route does not expose `version=signed` / `version=original` — callers holding API tokens continue using the primary route.

### 6. NEW: `packages/lib/server-only/pdf/generate-partial-signed-pdf.ts`
Small orchestrator — trimmed parallel of `decorateAndSignPdf` from `seal-document.handler.ts`:
- `PDFDocument.load(bytes)` → `flattenAll()` → `updatePdfVersion(1.7)`.
- Draw diagonal watermark across page 1 using pdf-lib (`drawText` rotated ~45°, low opacity grey/red).
- Draw small footer line on every page with the banner text (font size ~8pt, bottom margin).
- Banner text: `DRAFT — Not a final executed document. Awaiting {N} more signature(s). Envelope {envelopeId} · {ISO-UTC}`. Pluralize correctly (`1 signature` vs `N signatures`; drop "more" naturally).
- For each page, collect its `FieldWithSignature` and call `insertFieldInPDFV2` (already exported from `packages/lib/server-only/pdf/insert-field-in-pdf-v2.ts`).
- `flattenAll()` again, `save()` to bytes.
- **Do not** call `signPdf`, `generateCertificatePdf`, `generateAuditLogPdf`, `putPdfFileServerSide`, or any DB write.

Justification for new file: orchestration is non-trivial (page iteration, field grouping, watermark + footer rendering, pluralization) and the equivalent logic in `decorateAndSignPdf` is private. Extracting a partial-only function avoids entangling the seal-document job.

## Reused Utilities (no changes)

- `packages/lib/server-only/pdf/insert-field-in-pdf-v2.ts` — burns field array into PDF page.
- `packages/lib/universal/upload/get-file.server.ts` → `getFileServerSide` — loads PDF bytes from `DocumentData`.
- `packages/lib/utils/pdf.ts` → `flattenAll`, `updatePdfVersion`.
- `AppError` with codes `ENVELOPE_DRAFT`, `ENVELOPE_COMPLETED`, `ENVELOPE_REJECTED`, `ENVELOPE_VOIDED`, `NOT_IMPLEMENTED`, `UNAUTHORIZED` / `FORBIDDEN`.
- Existing recipient-token resolver used by `/sign/[token]` signing routes.

## Verification

1. **E2E test** (new, `packages/app-tests/e2e/`):
   - Seed envelope with 2 SIGNER recipients, internalVersion=2.
   - Recipient 1 signs via `apiSignin` + completion helper.
   - With API token: `GET /api/v2/envelope/item/{id}/download?version=pending` → 200, `application/pdf`, response starts with `%PDF-`.
   - Parse with pdf-lib: page count equals original (no cert pages appended).
   - Text extraction page 1 contains `DRAFT`, `Awaiting 1 more signature`, envelope id, and an ISO timestamp.
   - Second call with `If-None-Match: <etag>` → 304.
   - Recipient 2 completes signing → envelope flips to COMPLETED.
   - Re-call `version=pending` → 400 with `AppError` JSON body, code `ENVELOPE_COMPLETED`.
   - Caller retries `version=signed` → 200 with fully sealed PDF.

2. **Recipient-token E2E**:
   - Recipient 1 (signed): `GET /api/v2/sign/{recipient1Token}/envelope-item/{id}/download?version=pending` → 200.
   - Recipient 2 (not yet signed): same call with recipient 2's token → 403.
   - Recipient who rejected: 200.

3. **Negative cases**:
   - DRAFT envelope → 400 `ENVELOPE_DRAFT`.
   - internalVersion=1 PENDING envelope → 501 `NOT_IMPLEMENTED`.
   - No / wrong API token → existing 401/403 path untouched.
   - Assistant-only inserted fields, no signer signed: 200, banner shows `Awaiting 2 more signatures`, fields rendered.

4. **Manual smoke**:
   - Open returned PDF in Acrobat → no PKI signature panel; diagonal watermark on page 1; footer on every page.
   - Confirm pluralization at N=1.

5. **Type + lint**: `npx tsc --noEmit -p apps/remix/tsconfig.json` and `npm run lint`.

## Out of Scope / Follow-ups

- Per-recipient certificate endpoint — not building now.
- v1 API parity — not building.
- Internal "View" UI wiring during PENDING — not building (overlay-based viewer already shows signatures in-app).
- Persistent caching layer / job-queue generation — revisit if p95 latency on large PDFs or CPU pressure becomes an issue.
- i18n of banner text — English only for now; envelope.language / `?locale=` support deferred.
- Concurrency guardrails (semaphore, per-envelope lock) — defer; rely on existing API rate limiter.

## Unresolved Questions

- None blocking.
