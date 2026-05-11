---
date: 2026-04-22
title: Partial Signed Pdf Download
---

## Summary

Let team members fetch a PDF with all currently-inserted fields burned in while the envelope is still in `PENDING` status. Today the only available bytes for a pending envelope are the original (no fields) - the sealed PDF only materialises after the last recipient signs and the `seal-document` job runs.

Exposed in two places:

- v2 API: `GET /api/v2/envelope/item/{envelopeItemId}/download?version=pending` (API-token auth)
- UI: a `Partial` button in the existing `EnvelopeDownloadDialog`, alongside `Original`. Replaces the `Signed` slot when the envelope is `PENDING`. Backed by the existing session-authed file route `GET /api/files/envelope/{envelopeId}/envelopeItem/{id}/download/pending`.

## Scope

- v2 API only (no v1).
- `internalVersion === 2` envelopes only. Legacy v1 returns 400 `ENVELOPE_LEGACY`.
- Team-side / owner only. No recipient-token download path - recipients have the in-app overlay viewer for verification, and a downloadable half-signed PDF is a leak vector for partially-executed contracts. Enforced both at the server (the recipient-token file route does not accept `pending`) and at the UI (the dialog hides the Partial button when a recipient token is set).
- No PKI signature, no certificate page, no audit log appendix - the response is explicitly not a final executed document.
- No watermark or banner text. The filename suffix (`_pending.pdf`), the `Cache-Control: no-store, private` header, and the absence of a PKI signature are sufficient to signal draft status.

## Behaviour

API response matrix (both `/api/v2/envelope/item/{id}/download?version=pending` and the UI-facing `/api/files/envelope/{envelopeId}/envelopeItem/{id}/download/pending`):

| Envelope status | Response |
|---|---|
| `PENDING` (v2) | 200, PDF with currently-inserted fields burned in |
| `PENDING` (v1) | 400 `ENVELOPE_LEGACY` |
| `DRAFT` | 400 `ENVELOPE_DRAFT` |
| `COMPLETED` | 400 `ENVELOPE_COMPLETED` |
| `REJECTED` | 400 `ENVELOPE_REJECTED` |

All v1-vs-v2 / status-mismatch errors are 4xx so callers can cleanly separate them from real server failures (5xx). Specifically v1 PENDING returns 400 not 501: 5xx is reserved for actual server problems, while "this envelope can't satisfy this request shape" is a client-addressable condition.

Filename: `{title}_pending.pdf`.

ETag is content-addressed over `sha256(envelope.status + sorted((field.id, field.customText, field.signature?.id, field.signature?.created) for inserted===true fields))`. Returns 304 on `If-None-Match` match.

No persistent caching. Generated on-demand per request when ETag misses.

Error response shape (envelope item v2 download route and the team-side file route): preserves the existing `{ error: <message> }` field for backwards compatibility and adds `code: <APP_ERROR_CODE>` as a new field for callers that want to branch on it. The document download route (`/document/{documentId}/download`) is untouched.

## UI

`apps/remix/app/components/dialogs/envelope-download-dialog.tsx`:

- The dialog shows `Original` plus one of:
  - `Signed` when status is `COMPLETED` (existing behaviour)
  - `Partial` when status is `PENDING`, there is no recipient token, and the envelope is not legacy (`!isLegacy`)
  - nothing otherwise
- New optional prop `isLegacy?: boolean`. Only consulted to gate the `Partial` button, so callers whose status can never be `PENDING` (DRAFT/COMPLETED/REJECTED hardcoded, or `isComplete: true` matchers) and callers that always set a recipient token can omit it. Three call sites pass it (`isLegacy={envelope.internalVersion === 1}`): `documents-table-action-dropdown.tsx`, `envelope-editor.tsx`, `document-page-view-dropdown.tsx`. The other eight callers were left alone.

Trade-off: a future team-side dialog usage where status could be PENDING but the dev forgets `isLegacy` will silently not render the Partial button. The status gate prevents an actively broken click; missing button is discoverable in testing. Required-prop alternative was rejected because eight of eleven call sites would carry a meaningless value.

## Files

Server:

- `apps/remix/server/api/download/download.types.ts` - added `'pending'` to the `version` enum; split the validator into `param` (envelopeItemId) + `query` (version). The original wiring as a path-param validator was a pre-existing bug: requests like `?version=original` were silently returning the signed PDF since `version` actually arrives as a query string. Fixed as a side effect.
- `packages/trpc/server/envelope-router/download-envelope-item.types.ts` - mirrored the enum change in the OpenAPI schema.
- `apps/remix/server/api/download/download.ts` - the envelope item v2 route now fetches envelope recipients alongside the envelope, branches on `version` when calling the helper, and emits AppError responses as `{ error, code }` consistently across all status codes.
- `apps/remix/server/api/files/files.types.ts` - added `'pending'` to the team-side download schema only. The recipient-token download schema is untouched, so `/api/files/token/.../download/pending` is rejected by the schema validator.
- `apps/remix/server/api/files/files.ts` - the team-side download handler fetches envelope recipients and dispatches the `pending` branch through the same `handleEnvelopeItemFileRequest` helper. Wrapped in a try/catch that returns `{ error, code }` for AppErrors.
- `apps/remix/server/api/files/files.helpers.ts` - `handleEnvelopeItemFileRequest` is now a single entry point taking a discriminated-union options type. The static-file flow (`signed`/`original`) and the on-demand pending flow are private helpers in the same module.
- `packages/lib/server-only/pdf/generate-partial-signed-pdf.ts` (new) - small orchestrator that loads the original PDF, groups inserted fields by page, calls the existing `insertFieldInPDFV2` overlay helper for each page, flattens, and saves.
- `packages/lib/errors/app-error.ts` - added `ENVELOPE_DRAFT`, `ENVELOPE_COMPLETED`, `ENVELOPE_REJECTED`, `ENVELOPE_LEGACY` codes, all mapped to 400. The legacy-envelope case deliberately returns 4xx rather than 501 to keep "this resource can't satisfy this operation" distinct from real 5xx server failures in caller logs/metrics.

Client:

- `packages/lib/utils/envelope-download.ts` - `EnvelopeItemPdfUrlOptions` download variant now allows `'pending'` as a version. The recipient-token URL builder will produce a URL the server rejects, but the dialog gates on no-token at the call site.
- `packages/lib/client-only/download-pdf.ts` - `DocumentVersion` extended; filename suffix logic moved into a small switch (`_signed.pdf`, `_pending.pdf`, `.pdf`).
- `apps/remix/app/components/dialogs/envelope-download-dialog.tsx` - secondary download derivation with the new `Partial` branch, optional `isLegacy` prop.
- `apps/remix/app/components/tables/documents-table-action-dropdown.tsx`, `apps/remix/app/components/general/envelope-editor/envelope-editor.tsx`, `apps/remix/app/components/general/document/document-page-view-dropdown.tsx` - pass `isLegacy={envelope.internalVersion === 1}` (or `row.internalVersion === 1`) to the dialog.

## Verification

1. E2E (`packages/app-tests/e2e/api/v2/partial-signed-pdf-download.spec.ts`):
   - Pending envelope, recipient 1 signs, API token download with `?version=pending` returns 200 + PDF; subsequent call with `If-None-Match: <etag>` returns 304; after recipient 2 completes the envelope flips to `COMPLETED` and the same call returns 400 `ENVELOPE_COMPLETED`; `?version=signed` then succeeds.
   - Draft envelope returns 400 `ENVELOPE_DRAFT`.
   - `internalVersion === 1` pending envelope returns 400 `ENVELOPE_LEGACY`.

2. `npx tsc --noEmit -p apps/remix/tsconfig.json` and `npm run lint`.

3. Manual: open the Documents table or envelope editor on a PENDING envelope (v2), open the download dialog, confirm `Partial` appears alongside `Original` and produces a `_pending.pdf` with current fields burned in. Same dialog on a COMPLETED envelope shows `Signed`. Same dialog on a v1 PENDING envelope shows neither (status gate would show Partial, but the `isLegacy` flag filters it out).

## Out of Scope / Follow-ups

- Recipient-token download path (API and UI) - decided against. Revisit if there is concrete demand and a story for limiting the leak vector.
- v1 API parity / v1 partial rendering - not building. Implementing partial for v1 would require porting `legacy_insertFieldInPDF` / `insertFieldInPDFV1` into a partial-only flow, which is code with no long-term home as v1 is being phased out.
- Document download route (`/document/{documentId}/download`) - untouched. Same error shape and validator wiring as before. Consider normalising to the same `{ error, code }` shape in a follow-up if any caller wants to branch on `code` from that route.
- Persistent caching layer / job-queue generation - revisit if p95 latency on large PDFs becomes an issue.
- Specific toast for `ENVELOPE_LEGACY` in the dialog - currently the catch-all "Something went wrong" handles it. Worth a polish if v1 PENDING envelopes are common in your data and we see complaints. (Note: with the `isLegacy` gate at the UI, the error is unreachable from the dialog itself; the API can still surface it for direct callers.)
