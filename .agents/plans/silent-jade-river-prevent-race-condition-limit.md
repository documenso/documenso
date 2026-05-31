---
date: 2026-05-31
title: Prevent Free Tier Quota Race Condition
---

## Summary

Prevent a race condition vulnerability where concurrent requests sent in a single packet (e.g. parallel HTTP/2 single-packet attacks) bypass the monthly free-tier limit of 5 documents. Currently, the "5 documents per month" limit is checked inside the tRPC resolver using a non-atomic read (`getServerLimits()`). Because this check is non-atomic and executes outside the database transaction, parallel requests all see a count below the limit, bypassing the quota entirely.

This fix introduces a two-tier defense:
1. **Entry rate limit lock (`documentCreationRateLimit`)**: Restricts envelope creation requests to a maximum of 1 per 3 seconds per user to prevent CPU exhaustion from concurrent PDF conversions and S3 file leaks.
2. **Row-Level Transaction Lock (`SELECT ... FOR UPDATE`)**: Inside `createEnvelope`'s interactive database transaction, we serialize document creation for Free plan users, guaranteeing 100% thread-safety and zero false-positives without affecting paid/enterprise users.

---

## 1. Design Decisions

- **Two-Tier Defense**:
  - **First Line (Entry Rate Limit)**: A lightweight, per-user rate limit (1 request per 3 seconds) keyed on `userId` in the tRPC router to block high-frequency parallel requests before S3 upload.
  - **Second Line (Database Row Lock)**: A conditional row-level database serialization lock inside the interactive transaction to serialize remaining requests in a thread-safe manner.
- **Selective Locking (Zero Paid Overhead)**: We only acquire the database row lock if billing is enabled and the organization is on the `FREE` plan. Paid and Enterprise users bypass this block entirely, ensuring zero performance impact on paid users.
- **Row-Level Serialization (`SELECT ... FOR UPDATE`)**: Inside `prisma.$transaction`, we lock the `Organisation` row belonging to the team. This serializes all concurrent envelope creation requests for that specific organization.
- **Microsecond Hold Time**: The transaction block contains only fast, in-memory database writes and queries (creating envelope, mapping recipients). It has absolutely no external network I/O or S3 uploads (which are performed outside the transaction). The lock is held for less than 5ms under ordinary circumstances.
- **Graceful Lock Timeout**: We configure a lock timeout (`SET LOCAL lock_timeout = '1s'`) so that in the extremely rare event of a database freeze, connections do not hang and starve the Prisma connection pool.

---

## 2. Proposed Changes

### 2.1 Modified File: `packages/lib/server-only/rate-limit/rate-limits.ts`
Added `documentCreationRateLimit` instance:
```typescript
export const documentCreationRateLimit = createRateLimit({
  action: 'api.document-creation',
  max: 1,
  window: '3s',
});
```

### 2.2 Modified File: `packages/trpc/server/envelope-router/create-envelope.ts`
Enforce the entry rate limit at the very top of `createEnvelopeRouteCaller` before doing PDF conversion and S3 uploads:
```typescript
  if (type === EnvelopeType.DOCUMENT) {
    const rateLimitResult = await documentCreationRateLimit.check({
      ip: apiRequestMetadata.requestMetadata.ipAddress ?? 'unknown',
      identifier: String(userId),
    });

    if (rateLimitResult.isLimited) {
      throw new AppError(AppErrorCode.TOO_MANY_REQUESTS, {
        message: 'Too many envelope creation requests. Please wait a few seconds and try again.',
        statusCode: 429,
      });
    }
  }
```

### 2.3 Modified File: `packages/lib/server-only/envelope/create-envelope.ts`
Insert the conditional row lock and count re-verification at the very beginning of the interactive transaction (`prisma.$transaction` block):
```typescript
  const createdEnvelope = await prisma.$transaction(async (tx) => {
    // Acquire a row-level lock to prevent concurrent quota bypasses for free tier organisations
    if (
      type === EnvelopeType.DOCUMENT &&
      IS_BILLING_ENABLED() &&
      team.organisation.organisationClaim.id === INTERNAL_CLAIM_ID.FREE
    ) {
      // Lock the organisation row to serialize concurrent checks
      await tx.$executeRaw`
        SELECT id FROM "Organisation" 
        WHERE id = ${team.organisationId} 
        FOR UPDATE
      `;

      // Re-verify the current month document count inside the locked transaction
      const currentCount = await tx.envelope.count({
        where: {
          type: EnvelopeType.DOCUMENT,
          team: {
            organisationId: team.organisationId,
          },
          createdAt: {
            gte: DateTime.utc().startOf('month').toJSDate(),
          },
          source: {
            not: DocumentSource.TEMPLATE_DIRECT_LINK,
          },
        },
      });

      if (currentCount >= 5) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'You have reached your document limit for this month. Please upgrade your plan.',
          statusCode: 400,
        });
      }
    }

    const envelope = await tx.envelope.create({
      // Normal envelope creation logic proceeds...
```

---

## 3. Verification Plan

### 3.1 E2E Playwright Test: `packages/app-tests/e2e/envelopes/free-tier-race-condition.spec.ts`
Simulates a high-concurrency attack where a Free plan user fires 5 concurrent document creation requests at the exact same millisecond:
- Setup: Seed a new user/team/organisation, force organisation claim to `free` tier, and seed 4 existing monthly documents (so 1 slot remains).
- Act: Trigger 5 concurrent HTTP POST requests to `/envelope/create` in parallel using `Promise.all`.
- Assert: Exactly 1 request succeeds (200), and the remaining 4 requests are rejected with clean 400 (limit exceeded) or 429 (rate limited) errors. The database final count must be exactly 5.

### 3.2 Manual Verification
1. Log in with a verified account on the Free plan.
2. Intercept the document creation request using a proxy tool (e.g. Burp Suite).
3. Clone the request and group them to execute a parallel HTTP/2 single-packet attack (sending 10 requests at the exact same millisecond).
4. Verify that exactly 1 request succeeds (advancing the count to the maximum 5) and the other 9 requests fail with a clean 400/429 error.
5. Verify that S3 is not flooded with orphaned files and no database deadlocks occur.
