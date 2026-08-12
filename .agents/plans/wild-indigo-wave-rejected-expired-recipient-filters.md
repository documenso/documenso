---
date: 2026-05-28
title: Rejected Expired Recipient Filters
---

## Context

Customers need to find (a) envelopes/documents in the `REJECTED` state and (b) envelopes
with at least one recipient whose signing link has **expired**. Today the UI only exposes
`INBOX / PENDING / COMPLETED / DRAFT / ALL` tabs, and the public API has no way to filter by
expired recipient links — forcing a fetch-all-`PENDING`-then-inspect-each-recipient workaround.

Two key facts from exploration shaped this plan:

- **`REJECTED` is already fully wired in the backend** — the where-clause (`find-documents.ts`),
  stats counts (`get-stats.ts`), tRPC response schema, `ExtendedDocumentStatus` enum, and the
  `FRIENDLY_STATUS_MAP` display all handle it. It is simply absent from the UI tab array.
- **Renewing expired links already works.** `resendDocument` refreshes `expiresAt` and clears
  `expirationNotifiedAt` for unsigned, non-CC recipients (`resend-document.ts:98-121`), exposed
  publicly via `POST /api/v2/document/redistribute` and `/api/v2/envelope/redistribute` and via the
  resend/redistribute UI dialogs. No new renew mechanism is needed — only documentation/wording.

Expiration is a per-recipient condition (not an envelope status). The approved design models it
in the UI as an `EXPIRED` **pseudo-status tab** (reusing the existing tab machinery, mirroring how
`REJECTED` works) and in the public API as an orthogonal boolean `hasExpiredRecipients`. Both share
one EXISTS predicate.

Definition of "expired recipient" (matches `isRecipientExpired`, `packages/lib/utils/recipients.ts:118`):
a `Recipient` with `expiresAt IS NOT NULL AND expiresAt <= now() AND signingStatus = NOT_SIGNED AND role != CC`.

## Approach

### A. Shared EXISTS predicate (reused 4x, justified)
Add a local `hasExpiredRecipient(eb)` helper — modeled on the existing per-file `recipientExists` /
`senderEmailIs` helpers — to `find-documents.ts`, `get-stats.ts`, and `find-envelopes.ts`. It is the
single source of truth for the expired condition above (using `new Date()` for `now`, matching the
`period` filter's `.toJSDate()` style).

### B. REJECTED tab (UI only — backend already done)
- `apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents._index.tsx`: add
  `ExtendedDocumentStatus.REJECTED` to the tab array (lines 149-155). Count badge, highlight, and
  `?status=REJECTED` filtering already work via existing machinery.

### C. EXPIRED pseudo-status (UI + internal stats)
1. `packages/prisma/types/extended-document-status.ts`: add `EXPIRED: 'EXPIRED'`. Internal-only —
   the public `DocumentStatus` enum is unaffected. This intentionally surfaces TS errors at the three
   exhaustive/`Record<ExtendedDocumentStatus>` sites below, forcing them to be handled.
2. `packages/lib/server-only/document/find-documents.ts`:
   - Add `.with(ExtendedDocumentStatus.EXPIRED, ...)` to **both** `applyPersonalFilters` and
     `applyTeamFilters`, mirroring the `COMPLETED` branch's access control (deleted + visibility +
     owner/recipient access) with `hasExpiredRecipient(eb)` AND-ed in. Do **not** constrain
     `Envelope.status` — the EXISTS already restricts to unsigned recipients.
3. `packages/lib/server-only/document/get-stats.ts`:
   - Add an `expiredQuery` mirroring `pendingQuery`'s access control + `hasExpiredRecipient(eb)`.
   - Add it to the `Promise.all`, add `[ExtendedDocumentStatus.EXPIRED]: expired` to the `stats`
     record. **Do not** add `expired` to the `all` sum (it overlaps `PENDING`).
4. `packages/trpc/server/document-router/find-documents-internal.types.ts`: add
   `[ExtendedDocumentStatus.EXPIRED]: z.number()` to the `stats` response object. (`status` already
   accepts the extended enum via `z.nativeEnum(ExtendedDocumentStatus)`.)
5. `apps/remix/app/components/general/document/document-status.tsx`: add an `EXPIRED` entry to
   `FRIENDLY_STATUS_MAP` — `label: msg` Expired, an icon (e.g. lucide `TimerOff`, matching the
   `/sign/$token/expired` page), and a distinct color (e.g. `text-orange-500`) to differentiate from
   `REJECTED` (red).
6. `documents._index.tsx`: add `[ExtendedDocumentStatus.EXPIRED]: 0` to the `stats` `useState`
   initializer and `ExtendedDocumentStatus.EXPIRED` to the tab array. Final order:
   `INBOX, PENDING, COMPLETED, DRAFT, REJECTED, EXPIRED, ALL`.
7. (Optional, recommended) `apps/remix/app/components/tables/documents-table-empty-state.tsx`: add
   tailored `EXPIRED` and `REJECTED` empty-state copy (currently both fall through to `.otherwise()`).

### D. Public API boolean `hasExpiredRecipients` (document + envelope, v2)
1. `packages/lib/server-only/document/find-documents.ts`: add `hasExpiredRecipients?: boolean` to
   `FindDocumentsOptions`; when true, apply `.where((eb) => hasExpiredRecipient(eb))` inside
   `buildBaseQuery` (orthogonal/additive to any `status`).
2. `packages/trpc/server/document-router/find-documents.types.ts`: add a query-safe boolean
   `hasExpiredRecipients` to `ZFindDocumentsRequestSchema` with a `.describe(...)`. Mirror the
   existing boolean-query-param handling in `find-document-audit-logs.types.ts`
   (`filterForRecentActivity`) — avoid raw `z.coerce.boolean()` (the "false" -> true footgun); use a
   string transform if needed. Pass it through in `find-documents.ts` (public handler).
3. `packages/lib/server-only/envelope/find-envelopes.ts`: add `hasExpiredRecipients?: boolean` to
   `FindEnvelopesOptions` + the `hasExpiredRecipient(eb)` helper + the additive `.where`.
4. `packages/trpc/server/envelope-router/find-envelopes.types.ts`: add the same param to
   `ZFindEnvelopesRequestSchema`; pass it through in the envelope-router find handler.
   The param auto-appears in the generated `/api/v2/openapi.json`.

Note: REST v1 `GET /api/v1/documents` is deprecated and lacks status filtering — left unchanged.
`REJECTED` is already a valid public `status` value (`DocumentStatus.REJECTED`), so no API change is
needed for rejected filtering.

### E. Renew expired links — documentation only
No functional change. Document that resending renews expired links:
- Update the `.description` in `packages/trpc/server/document-router/redistribute-document.types.ts`
  and `packages/trpc/server/envelope-router/redistribute-envelope.types.ts` to state that
  redistributing refreshes the signing-link expiration for unsigned recipients.
- Optionally adjust resend/redistribute dialog copy
  (`apps/remix/app/components/dialogs/document-resend-dialog.tsx`,
  `envelope-redistribute-dialog.tsx`) to mention it renews expired links.

## Files To Modify (summary)

| Area | File |
|------|------|
| Enum | `packages/prisma/types/extended-document-status.ts` |
| Where-clause + API option | `packages/lib/server-only/document/find-documents.ts` |
| Stats counts | `packages/lib/server-only/document/get-stats.ts` |
| Envelope find (API) | `packages/lib/server-only/envelope/find-envelopes.ts` |
| Internal tRPC stats schema | `packages/trpc/server/document-router/find-documents-internal.types.ts` |
| Public doc API schema + handler | `packages/trpc/server/document-router/find-documents.types.ts`, `find-documents.ts` |
| Public envelope API schema + handler | `packages/trpc/server/envelope-router/find-envelopes.types.ts`, `find-envelopes.ts` |
| Status display | `apps/remix/app/components/general/document/document-status.tsx` |
| Tabs + stats init | `apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents._index.tsx` |
| Empty state (optional) | `apps/remix/app/components/tables/documents-table-empty-state.tsx` |
| Renew docs | `redistribute-document.types.ts`, `redistribute-envelope.types.ts` (+ resend dialogs, optional) |

## Reused Utilities / Patterns
- `recipientExists` / `senderEmailIs` (per-file Kysely EXISTS helpers) — the template for the new
  `hasExpiredRecipient` helper.
- `REJECTED` branches in `find-documents.ts` (lines 279, 416) and `rejectedQuery` in `get-stats.ts`
  (line 227) — the template for the `EXPIRED` branches / `expiredQuery`.
- `isRecipientExpired` (`packages/lib/utils/recipients.ts:118`) — defines the `expiresAt <= now`
  semantics to match.
- Existing tab machinery in `documents._index.tsx` (`getTabHref`, count badge, personal-org `.filter`)
  — works unchanged for the new tabs.
- `resendDocument` / `trpc.document.redistribute` / `trpc.envelope.redistribute` — existing renew path.

## Verification
1. **Typecheck** (the enum change forces all exhaustive/Record sites): `npm run typecheck -w @documenso/remix`.
2. **Seed + UI** (dev server already running): seed a team via `seedTeam`, send a document, then:
   - Reject one as a recipient -> it appears under the new **Rejected** tab with a count.
   - Force expiry (set a recipient `expiresAt` in the past, e.g. via Prisma Studio or a short
     `envelopeExpirationPeriod`) -> the doc appears under the new **Expired** tab with a count, and the
     count excludes signed/CC recipients.
3. **Public API**: `GET /api/v2/document?hasExpiredRecipients=true` and
   `GET /api/v2/envelope?hasExpiredRecipients=true` (Bearer API token) return only envelopes with >=1
   expired unsigned recipient; confirm `GET /api/v2/document?status=REJECTED` works. Verify the param
   appears in `/api/v2/openapi.json`.
4. **Renew**: on an expired doc, run resend/redistribute (UI dialog or
   `POST /api/v2/document/redistribute`) -> recipient `expiresAt` is refreshed, the doc leaves the
   Expired tab, and the signing link no longer redirects to `/sign/$token/expired`.
5. **E2E** (optional): extend `packages/app-tests/e2e/envelopes/envelope-expiration-send.spec.ts`
   with an Expired-tab assertion.
6. Do **not** modify/commit `packages/lib/translations/*.po`; run `npm run translate` only if needed
   for new `msg`/`Trans` strings, and keep generated `.po` files out of the branch.

## Open Questions
- Exact icon/color for the `EXPIRED` tab (proposed: `TimerOff`, `text-orange-500`).
- Whether to add the optional tailored empty-state copy now or defer.