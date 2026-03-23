---
date: 2026-02-10
title: Envelope Expiration
---

## Summary

Envelopes (documents sent for signing) should automatically expire after a configurable period, preventing recipients from completing stale documents. Expiration is tracked **per-recipient** — when a recipient's signing window lapses, the document owner is notified and can resend (extending the deadline) or cancel. The document itself stays PENDING so other recipients can continue signing.

**Settings cascade**: Organisation → Team → Document (each level can override the prior).
**Default**: 1 month from when the envelope is sent (transitions to PENDING).

---

## 1. Database Schema Changes

### 1.1 Expiration period data shape

Store expiration as a structured JSON object rather than an enum or raw milliseconds. This avoids the enum treadmill (adding `FOUR_MONTHS` later requires a migration) while keeping values validated and meaningful.

**Zod schema** (defined in `packages/lib/constants/envelope-expiration.ts`):

```typescript
export const ZEnvelopeExpirationPeriod = z.union([
  z.object({ unit: z.enum(['day', 'week', 'month', 'year']), amount: z.number().int().min(1) }),
  z.object({ disabled: z.literal(true) }),
]);

export type TEnvelopeExpirationPeriod = z.infer<typeof ZEnvelopeExpirationPeriod>;
```

Semantics:

- `null` on `DocumentMeta` / `TeamGlobalSettings` = inherit from parent
- `{ disabled: true }` = explicitly never expires
- `{ unit: 'month', amount: 1 }` = expires in 1 month

No Prisma enum is needed — the period is stored as `Json?` on the relevant models (see sections 1.3 and 1.4).

### 1.2 Add expiration fields to `Recipient`

```prisma
model Recipient {
  // ... existing fields
  expiresAt              DateTime?
  expirationNotifiedAt   DateTime?   // null = not yet notified; set when owner notification sent

  @@index([expiresAt])
}
```

`expiresAt` is a computed timestamp set when the envelope transitions to PENDING (at send time). It is calculated from the effective expiration period. Storing the concrete timestamp rather than a relative duration means:

- Sweep queries are simple (`WHERE expiresAt <= NOW() AND expirationNotifiedAt IS NULL`)
- No need to re-resolve the settings cascade at query time
- The sender can see the exact deadline in the UI
- The index on `expiresAt` ensures the expiration sweep query is efficient

`expirationNotifiedAt` tracks whether the owner has already been notified about this recipient's expiration, making the notification job idempotent.

### 1.3 Add expiration period to settings models

**OrganisationGlobalSettings** (JSON, application-level default):

```prisma
model OrganisationGlobalSettings {
  // ... existing fields
  envelopeExpirationPeriod Json?
}
```

Prisma `@default` doesn't work for `Json` columns, so the application-level default (`{ unit: 'month', amount: 1 }`) is applied in `extractDerivedTeamSettings` / `extractDerivedDocumentMeta` when the value is null. The migration should backfill existing rows with `{ "unit": "month", "amount": 1 }`.

**TeamGlobalSettings** (nullable, null = inherit from org):

```prisma
model TeamGlobalSettings {
  // ... existing fields
  envelopeExpirationPeriod Json?
}
```

### 1.4 Add expiration period to DocumentMeta

This allows per-document override during the document editing flow:

```prisma
model DocumentMeta {
  // ... existing fields
  envelopeExpirationPeriod Json?
}
```

When null on DocumentMeta, the resolved team/org setting is used at send time. Validated at write time using `ZEnvelopeExpirationPeriod.nullable()`.

**Important**: `envelopeExpirationPeriod` on `DocumentMeta` is a user-facing preference that may be set during the draft editing flow. It does NOT determine the final expiration — that is resolved at send time (see section 2.3). The value stored here is just the user's selection in the document editor.

---

## 2. Expiration Period Resolution

### 2.1 Duration mapping

Add to `packages/lib/constants/envelope-expiration.ts` alongside the Zod schema:

```typescript
import { Duration } from 'luxon';

const UNIT_TO_LUXON_KEY: Record<TEnvelopeExpirationPeriod['unit'], string> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  year: 'years',
};

export const DEFAULT_ENVELOPE_EXPIRATION_PERIOD: TEnvelopeExpirationPeriod = {
  unit: 'month',
  amount: 1,
};

export const getEnvelopeExpirationDuration = (period: TEnvelopeExpirationPeriod): Duration => {
  return Duration.fromObject({ [UNIT_TO_LUXON_KEY[period.unit]]: period.amount });
};
```

### 2.2 Settings cascade integration

`extractDerivedTeamSettings()` in `packages/lib/utils/teams.ts` needs **no code changes** — it iterates `Object.keys(derivedSettings)` and overrides with non-null team values at runtime. The new `envelopeExpirationPeriod` field on both `OrganisationGlobalSettings` and `TeamGlobalSettings` will be automatically picked up.

Update `extractDerivedDocumentMeta()` in `packages/lib/utils/document.ts` to include the new field:

```typescript
envelopeExpirationPeriod: meta.envelopeExpirationPeriod ?? settings.envelopeExpirationPeriod,
```

### 2.3 Compute `expiresAt` at send time

The expiration period is **locked at send time** — when the envelope transitions to PENDING. The concrete `expiresAt` timestamp is computed for each recipient when the document is actually sent.

In `packages/lib/server-only/document/send-document.ts`:

```typescript
// Resolve effective period: document meta -> team/org settings -> default
const rawPeriod =
  envelope.documentMeta?.envelopeExpirationPeriod ?? settings.envelopeExpirationPeriod;

const expiresAt = resolveExpiresAt(rawPeriod);

// Inside the $transaction, for each recipient:
await tx.recipient.updateMany({
  where: { envelopeId: envelope.id },
  data: { expiresAt },
});
```

### 2.4 Compute `expiresAt` in the direct template flow

`create-document-from-direct-template.ts` creates envelopes directly as PENDING and then calls `sendDocument` afterward. Since `sendDocument` handles setting `expiresAt` on recipients, the direct template flow doesn't need to set it directly — `sendDocument` handles it.

---

## 3. Cron Job Infrastructure (New)

The current job system is purely event-triggered. Inngest natively supports cron-triggered functions, but the local provider (used in dev and by self-hosters who don't want a third-party dependency) has no scheduling capability. This section adds cron support to the local provider to maintain feature parity.

### 3.1 Extend `JobDefinition` with cron support

Add an optional `cron` field to the trigger type in `packages/lib/jobs/client/_internal/job.ts`:

```typescript
export type JobDefinition<Name extends string = string, Schema = any> = {
  id: string;
  name: string;
  version: string;
  enabled?: boolean;
  optimizeParallelism?: boolean;
  trigger: {
    name: Name;
    schema?: z.ZodType<Schema>;
    /** Cron expression (e.g. "* * * * *"). When set, the job runs on a schedule. */
    cron?: string;
  };
  handler: (options: { payload: Schema; io: JobRunIO }) => Promise<Json | void>;
};
```

### 3.2 Inngest provider: wire up native cron

In `packages/lib/jobs/client/inngest.ts`, when defining a function, check for `cron`:

```typescript
defineJob(job) {
  if (job.trigger.cron) {
    this._functions.push(
      this._client.createFunction(
        { id: job.id, name: job.name },
        { cron: job.trigger.cron },
        async ({ step, logger }) => {
          const io = convertInngestIoToJobRunIo(step, logger, this);
          await job.handler({ payload: {} as any, io });
        },
      ),
    );
  } else {
    // Existing event-triggered logic (unchanged)
  }
}
```

### 3.3 Local provider: poller + deterministic `BackgroundJob` IDs

Use the existing `BackgroundJob` table for multi-instance dedupe instead of advisory locks. This approach keeps implementation Prisma-only (no raw SQL), works for single-instance and multi-instance deployments, and preserves existing retry/visibility behavior.

**On `defineJob()`**: If the job has a `cron` field, register an in-process scheduler entry and start a lightweight poller (every 30s with jitter).

**Each poll tick**:

1. Evaluate whether the cron schedule has one or more due run slots since the last tick (use a real cron parser, e.g. `cron-parser`)
2. For each due slot, build a deterministic run ID from job ID + scheduled slot time
3. Create a `BackgroundJob` row with that deterministic ID using Prisma
4. If insert succeeds → enqueue via the existing local job pipeline
5. If insert fails with Prisma `P2002` (unique violation) → another node already enqueued that run, skip

### 3.4 Summary of changes to the job system

| File                                        | Change                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `packages/lib/jobs/client/_internal/job.ts` | Add optional `cron` field to `trigger` type                      |
| `packages/lib/jobs/client/local.ts`         | Add cron poller + deterministic `BackgroundJob.id` dedupe        |
| `packages/lib/jobs/client/inngest.ts`       | Wire up `{ cron: ... }` in `createFunction` for cron jobs        |
| `packages/lib/jobs/client/_internal/*`      | Add cron helper utilities (`getDueCronSlots`, run ID generation) |

---

## 4. Expiration Processing

### 4.1 Two-job architecture

Expiration uses two jobs: a **sweep dispatcher** that runs on a cron schedule and finds expired recipients, and an **individual notification job** that handles the audit log, owner notification email, and webhook for a single recipient. This separation means:

- The sweep is lightweight and fast (just a query + N job triggers)
- Each recipient's expiration notification is independently retryable
- The individual jobs are idempotent — they check `expirationNotifiedAt IS NULL` before processing

### 4.2 Sweep job: `EXPIRE_RECIPIENTS_SWEEP_JOB`

A cron-triggered job that runs every minute to find and dispatch notifications for expired recipients.

**Definition:** `packages/lib/jobs/definitions/internal/expire-recipients-sweep.ts`

**Handler:** `packages/lib/jobs/definitions/internal/expire-recipients-sweep.handler.ts`

```typescript
const expiredRecipients = await prisma.recipient.findMany({
  where: {
    expiresAt: { lte: new Date() },
    expirationNotifiedAt: null,
    signingStatus: { notIn: [SigningStatus.SIGNED, SigningStatus.REJECTED] },
    envelope: { status: DocumentStatus.PENDING },
  },
  select: { id: true },
  take: 100,
});

for (const recipient of expiredRecipients) {
  await jobs.triggerJob({
    name: 'internal.notify-recipient-expired',
    payload: { recipientId: recipient.id },
  });
}
```

### 4.3 Individual notification job: `NOTIFY_RECIPIENT_EXPIRED_JOB`

An event-triggered job that handles a single recipient's expiration.

**Definition:** `packages/lib/jobs/definitions/internal/notify-recipient-expired.ts`

**Handler:** `packages/lib/jobs/definitions/internal/notify-recipient-expired.handler.ts`

The handler:

1. Fetches the recipient (with guard: `expirationNotifiedAt IS NULL` + not signed/rejected)
2. Sets `recipient.expirationNotifiedAt = now()` (idempotency)
3. Creates audit log entry with `DOCUMENT_RECIPIENT_EXPIRED` type
4. Sends email notification to the **document owner** (inline — no separate email job)
5. The document stays PENDING — the owner decides whether to resend or cancel

### 4.4 Register in job client

Add `EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION` and `NOTIFY_RECIPIENT_EXPIRED_JOB_DEFINITION` to the job registry in `packages/lib/jobs/client.ts`.

### 4.5 Email template: Recipient Expired

Target the **document owner**:

- Subject: `Signing window expired for "{recipientName}" on "{documentTitle}"`
- Body: "The signing window for {recipientName} ({recipientEmail}) on document {title} has expired. You can resend the document to extend their deadline or cancel the document."
- Include a "View Document" link to the document page in the app

Template files:

- `packages/email/templates/recipient-expired.tsx` — wrapper
- `packages/email/template-components/template-recipient-expired.tsx` — body

### 4.6 Recipient signing guard

In the signing flow, check `recipient.expiresAt` before allowing any signing action. Note that the document stays PENDING even after recipient expiration, so the existing `status !== PENDING` guard does not block expired recipients — an explicit expiration check is required:

```typescript
if (recipient.expiresAt && recipient.expiresAt <= new Date()) {
  throw new AppError(AppErrorCode.RECIPIENT_EXPIRED, {
    message: 'Recipient signing window has expired',
  });
}
```

**Files to update:**

- `packages/lib/server-only/document/complete-document-with-token.ts`
- `packages/lib/server-only/field/sign-field-with-token.ts`
- `packages/lib/server-only/field/remove-signed-field-with-token.ts`
- `packages/lib/server-only/document/reject-document-with-token.ts`

---

## 5. UI Design

### 5.1 Expiration Period Selector Component

Use a number input + unit selector combo. This gives organisations full flexibility to configure any duration without needing schema changes for new options.

**Layout**: A horizontal group with:

- A number `<Input>` (min 1, integer)
- A `<Select>` for the unit (`day`, `week`, `month`, `year`)
- A "Never expires" toggle/checkbox that disables the duration inputs and sets the value to `{ disabled: true }`

At the team level, include an "Inherit from organisation" option that clears the value to `null`.

**Validation**: Use `ZEnvelopeExpirationPeriod` for form validation.

### 5.2 Organisation Settings → Document Preferences

Add a "Default Envelope Expiration" field to the `DocumentPreferencesForm` component. At the org level, there is no "Inherit" option — it must have a concrete value (default: `{ unit: 'month', amount: 1 }`).

### 5.3 Team Settings → Document Preferences

Same field as org, but with the additional "Inherit from organisation" option (stored as `null`).

### 5.4 Document Editor → Settings Step

Add the expiration selector to `packages/ui/primitives/document-flow/add-settings.tsx` inside the "Advanced Options" accordion.

Label: **"Expiration"**
Description: _"How long recipients have to complete this document after it is sent."_

### 5.5 Recipient Signing Page — Expired State

When a recipient visits a signing link for an expired recipient:

- Redirect to `/sign/{token}/expired`
- Show a clear, non-alarming message: "Your signing window has expired. Please contact the sender for a new invitation."
- Do not show the signing form or fields
- The `isExpired` flag in `get-envelope-for-recipient-signing.ts` is derived from `recipient.expiresAt`

### 5.6 Embed Signing — Expired State

Embed signing routes handle recipient expiration by throwing `embed-recipient-expired`:

- `apps/remix/app/routes/embed+/_v0+/sign.$token.tsx` — both V1 and V2 loaders check expiration
- The embed error boundary renders an `EmbedRecipientExpired` component
- Direct templates (`direct.$token.tsx`) create fresh recipients so `isExpired` is always `false`

---

## 6. API / TRPC Changes

### 6.1 Update settings mutation schemas

- `packages/trpc/server/organisation-router/update-organisation-settings.types.ts` — add `envelopeExpirationPeriod: ZEnvelopeExpirationPeriod` (non-nullable at org level)
- `packages/trpc/server/team-router/update-team-settings.types.ts` — add `envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.nullable()` (null = inherit from org)

### 6.2 Update document mutation schemas

- `packages/lib/types/document-meta.ts` — add `envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.nullable()` to the meta schema
- `packages/trpc/server/document-router/create-document.types.ts` — include in meta
- `packages/trpc/server/document-router/update-document.types.ts` — include in meta
- `packages/trpc/server/document-router/distribute-document.types.ts` — include in meta

### 6.3 Expose `expiresAt` in recipient responses

Ensure `expiresAt` and `expirationNotifiedAt` are returned when fetching recipients/documents so the UI can display expiration status.

### 6.4 Webhook / API schema updates

- Recipient schema includes `expiresAt` and `expirationNotifiedAt` fields (replacing the old `expired` field)
- Update `packages/api/v1/schema.ts`, webhook payload types, zapier integration, and sample data generators

---

## 7. Edge Cases & Considerations

### 7.1 Already-sent documents

The migration should NOT retroactively expire existing recipients. `expiresAt` will be null for all existing recipients, meaning they never expire (backward-compatible).

### 7.2 Re-sending / redistributing

When `redistribute` is called on a PENDING document, `expiresAt` should be refreshed on all eligible recipients. Redistributing signals active intent, so the clock should restart.

**Implementation**: `resendDocument` refreshes `recipient.expiresAt` for all recipients that haven't signed/rejected yet.

### 7.3 Multi-recipient partial expiration

If some recipients have signed and others expire, the document stays PENDING. This is the key advantage over document-level expiration — the owner can resend to extend the expired recipients' deadlines without affecting those who've already signed.

### 7.4 Partial completion

Partial signatures are preserved. The document is not sealed/completed until all required recipients have signed (or the owner cancels).

### 7.5 Timezone handling

`expiresAt` is stored as UTC. Display in the sender's configured timezone.

### 7.6 Race condition: signing at expiration time

The signing guard checks `recipient.expiresAt` in application code before the signing operation. The notification job's guard (`expirationNotifiedAt IS NULL` + `signingStatus NOT IN (SIGNED, REJECTED)`) prevents double-notifications. If a recipient signs just before expiration, the sweep's `signingStatus` filter skips them.

### 7.7 Direct template flow

`create-document-from-direct-template.ts` creates envelopes directly as PENDING then calls `sendDocument`. Since `sendDocument` sets `recipient.expiresAt`, no special handling is needed in the direct template flow.

---

## 8. Migration Plan

1. Add Prisma schema changes (`expiresAt` + `expirationNotifiedAt` on Recipient, `Json?` fields on settings models, index)
2. Generate and run migration
3. Backfill: set `envelopeExpirationPeriod` to `{ "unit": "month", "amount": 1 }` on all existing `OrganisationGlobalSettings` rows
4. No backfill on `Recipient.expiresAt` — existing recipients keep null (never expire)
5. Deploy backend changes (jobs, guards, email template)
6. Deploy frontend changes (settings UI, document editor, signing page, embeds)

---

## 9. Files to Create or Modify

### New Files

- `packages/lib/constants/envelope-expiration.ts` — `ZEnvelopeExpirationPeriod` schema, types, `DEFAULT_ENVELOPE_EXPIRATION_PERIOD`, `getEnvelopeExpirationDuration()`, `resolveExpiresAt()` helper
- `packages/lib/jobs/definitions/internal/expire-recipients-sweep.ts` — cron sweep job definition
- `packages/lib/jobs/definitions/internal/expire-recipients-sweep.handler.ts` — cron sweep handler
- `packages/lib/jobs/definitions/internal/notify-recipient-expired.ts` — individual notification job definition
- `packages/lib/jobs/definitions/internal/notify-recipient-expired.handler.ts` — notification handler (includes inline email sending)
- `packages/email/templates/recipient-expired.tsx` — email template wrapper
- `packages/email/template-components/template-recipient-expired.tsx` — email template body
- `apps/remix/app/components/embed/embed-recipient-expired.tsx` — embed expired component

### Modified Files

**Job system (cron infrastructure):**

- `packages/lib/jobs/client/_internal/job.ts` — add optional `cron` field to `trigger` type
- `packages/lib/jobs/client/local.ts` — add cron poller + deterministic `BackgroundJob.id` dedupe
- `packages/lib/jobs/client/inngest.ts` — wire up `{ cron: ... }` in `createFunction`
- `packages/lib/jobs/client/_internal/*` — add cron helper utilities (slot calc + run ID)
- `packages/lib/jobs/client.ts` — register new jobs

**Schema & data layer:**

- `packages/prisma/schema.prisma` — model changes + index
- `packages/lib/utils/document.ts` — `extractDerivedDocumentMeta` (add `envelopeExpirationPeriod`)
- `packages/lib/server-only/document/send-document.ts` — resolve settings + compute and set `recipient.expiresAt`
- `packages/lib/server-only/template/create-document-from-direct-template.ts` — no changes (sendDocument handles it)
- `packages/lib/server-only/document/resend-document.ts` — refresh `recipient.expiresAt` on redistribute
- `packages/lib/server-only/document/complete-document-with-token.ts` — recipient expiration guard
- `packages/lib/server-only/field/sign-field-with-token.ts` — recipient expiration guard
- `packages/lib/server-only/field/remove-signed-field-with-token.ts` — recipient expiration guard
- `packages/lib/server-only/document/reject-document-with-token.ts` — recipient expiration guard

**Error handling:**

- `packages/lib/errors/app-error.ts` — add `RECIPIENT_EXPIRED` error code

**Audit logs:**

- `packages/lib/types/document-audit-logs.ts` — add `DOCUMENT_RECIPIENT_EXPIRED` type with `recipientEmail`/`recipientName` data fields
- `packages/lib/utils/document-audit-logs.ts` — add human-readable rendering for `DOCUMENT_RECIPIENT_EXPIRED`

**Signing page:**

- `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts` — derive `isExpired` from `recipient.expiresAt`
- `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx` — keep redirect to expired page using `isExpired`

**Embeds:**

- `apps/remix/app/routes/embed+/_v0+/sign.$token.tsx` — check recipient expiration in V1/V2 loaders
- `apps/remix/app/routes/embed+/_v0+/_layout.tsx` — handle `embed-recipient-expired` in error boundary

**Webhook / API:**

- `packages/lib/types/recipient.ts` — add `expiresAt`/`expirationNotifiedAt` to recipient type
- `packages/lib/types/webhook-payload.ts` — add `expiresAt`/`expirationNotifiedAt` to webhook recipient
- `packages/lib/server-only/webhooks/trigger/generate-sample-data.ts` — update sample data
- `packages/lib/server-only/webhooks/zapier/list-documents.ts` — update zapier recipient shape
- `packages/api/v1/schema.ts` — add `expiresAt` to API recipient schema

**TRPC / settings:**

- `packages/trpc/server/organisation-router/update-organisation-settings.types.ts`
- `packages/trpc/server/team-router/update-team-settings.types.ts`
- `packages/lib/types/document-meta.ts`

**UI:**

- `apps/remix/app/components/forms/document-preferences-form.tsx` — add expiration period picker
- `packages/ui/primitives/document-flow/add-settings.tsx` — add expiration field
- `packages/ui/primitives/document-flow/add-settings.types.ts` — add to schema
