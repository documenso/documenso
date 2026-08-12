---
date: 2026-02-24
title: Custom Email Domain Sync And Recovery
---

## Problem Statement

Custom email domains configured via AWS SES can get stuck in a `PENDING` state or fail validation silently. Currently, there is **no automated verification** -- users must manually click "Sync" in the UI to check domain status. If a domain fails to validate, the only option is to delete it and recreate it, which generates new DKIM keys and requires the user to update their DNS records.

### Current Pain Points

1. **No background sync** -- Domain verification status is never checked automatically; users must manually click "Sync"
2. **Stuck domains** -- Domains can remain in `PENDING` state indefinitely with no alerting or auto-recovery
3. **Failed recovery requires DNS changes** -- Deleting and recreating a domain generates new keys, forcing the user to update DNS records
4. **No visibility into failure duration** -- There's no tracking of how long a domain has been pending

## Proposed Solution

### 1. Hourly Background Sync Job

Create a new cron job (`internal.sync-email-domains`) that runs every hour to automatically verify all `PENDING` email domains.

**Job Definition:** `packages/lib/jobs/definitions/internal/sync-email-domains.ts`
**Job Handler:** `packages/lib/jobs/definitions/internal/sync-email-domains.handler.ts`

**Pattern:** Follow the existing `cleanup-rate-limits` cron job pattern:

- `cron: '0 * * * *'` (every hour, on the hour)
- Empty `z.object({})` schema (no payload needed)
- Register in `packages/lib/jobs/client.ts`

**Handler Logic:**

1. Query all `EmailDomain` records with `status: 'PENDING'`
2. For each domain, call `verifyEmailDomain(emailDomainId)` which:
   - Calls AWS SES `GetEmailIdentityCommand` to check current verification status
   - Updates DB status to `ACTIVE` if verified, keeps `PENDING` otherwise
3. Log results via `io.logger` (how many checked, how many transitioned to ACTIVE)
4. Process domains in batches to avoid overwhelming SES API rate limits
5. Add error handling per-domain so one failure doesn't stop the entire sweep

### 2. Schema Changes -- Track Pending Duration

Add a `lastVerifiedAt` column to the `EmailDomain` model to track when verification was last attempted, enabling "stale domain" detection.

**File:** `packages/prisma/schema.prisma`

```prisma
model EmailDomain {
  // ... existing fields ...
  lastVerifiedAt DateTime?  // Last time verification was checked against SES
}
```

**Migration:** Create a new Prisma migration for this column addition.

**Updates needed:**

- `verify-email-domain.ts` -- Update `lastVerifiedAt` when verification is checked
- The sync job handler -- Use `lastVerifiedAt` to avoid re-checking domains that were just verified

### 3. Domain Re-registration (Recovery) -- Delete & Recreate in SES Without Changing Keys

Add a new "Re-register" action that deletes the SES identity and recreates it using the **same** DKIM key pair stored in the database, so the user's DNS records remain valid.

#### 3a. New Service Function

**File:** `packages/ee/server-only/lib/reregister-email-domain.ts`

```typescript
export const reregisterEmailDomain = async (options: { emailDomainId: string }) => {
  // 1. Fetch the EmailDomain record (including encrypted privateKey)
  // 2. Decrypt the private key using DOCUMENSO_ENCRYPTION_KEY
  // 3. Call DeleteEmailIdentityCommand on SES (ignore NotFoundException)
  // 4. Call CreateEmailIdentityCommand with BYODKIM using the SAME selector + private key
  // 5. Update EmailDomain status back to PENDING, update lastVerifiedAt
  // 6. Return the updated domain
};
```

Key points:

- Uses the existing encrypted `privateKey` from the DB -- no new key generation
- Uses the existing `selector` -- DNS records stay the same
- Deletes first, then recreates -- handles cases where SES state is corrupted
- Resets status to `PENDING` since verification will need to re-occur
- Uses `verifyDomainWithDKIM()` from `create-email-domain.ts` (may need to extract/export this helper)

#### 3b. Admin TRPC Routes (Find, Get, Re-register)

All email domain admin routes use `adminProcedure` -- requires system-level `Role.ADMIN`.

**Find (list) route:**
**File:** `packages/trpc/server/admin-router/find-email-domains.ts`
**Types:** `packages/trpc/server/admin-router/find-email-domains.types.ts`

- Query route: `admin.emailDomain.find`
- Input: `{ query?: string, page?: number, perPage?: number, status?: EmailDomainStatus }`
- Extends `ZFindSearchParamsSchema` with optional `status` filter
- Returns standard `ZFindResultResponse` with email domain data including: id, domain, status, selector, createdAt, lastVerifiedAt, organisation name, email count
- Prisma query filters by domain name (LIKE search on `query`), optional status, joins organisation for name, counts emails

**Get (detail) route:**
**File:** `packages/trpc/server/admin-router/get-email-domain.ts`
**Types:** `packages/trpc/server/admin-router/get-email-domain.types.ts`

- Query route: `admin.emailDomain.get`
- Input: `{ emailDomainId: string }`
- Returns full email domain detail: all fields (except privateKey), organisation info, list of associated emails, DNS records (generated from publicKey + selector)
- Omits `privateKey` from response

**Re-register (mutation) route:**
**File:** `packages/trpc/server/admin-router/reregister-email-domain.ts`
**Types:** `packages/trpc/server/admin-router/reregister-email-domain.types.ts`

- Mutation route: `admin.emailDomain.reregister`
- Input: `{ emailDomainId: string }`
- Calls `reregisterEmailDomain()`
- Rationale: Re-registration is a recovery/operational action that deletes and recreates an SES identity. This is a privileged operation that should only be performed by platform operators, not self-service by org admins.

#### 3c. Register in Admin Router

**File:** `packages/trpc/server/admin-router/router.ts`

Add a new `emailDomain` namespace to the admin router:

```typescript
emailDomain: {
  find: findEmailDomainsRoute,
  get: getEmailDomainRoute,
  reregister: reregisterEmailDomainRoute,
},
```

#### 3d. Admin Panel UI -- Email Domains Section

**List page:** `apps/remix/app/routes/_authenticated+/admin+/email-domains._index.tsx`

- New admin panel page at `/admin/email-domains`
- Follow the existing admin documents list pattern (client-side TRPC data fetching)
- Search input (debounced) filtering by domain name
- Status filter dropdown (All / Pending / Active)
- DataTable with columns: Domain, Organisation, Status (badge), Email Count, Created, Last Verified, Actions
- Actions dropdown per row: View details, Re-register
- Pagination via `DataTablePagination`

**Detail page:** `apps/remix/app/routes/_authenticated+/admin+/email-domains.$id.tsx`

- Shows full domain details: domain, selector, status, organisation, created date, last verified date
- Shows DNS records (DKIM + SPF) with copy buttons (reuse `organisation-email-domain-records-dialog` pattern)
- Table of associated organisation emails
- "Re-register" button with confirmation dialog explaining the action (SES identity will be deleted and recreated with the same keys)
- "Verify Now" button to manually trigger a verification check
- Shows how long the domain has been pending (using `lastVerifiedAt` or `createdAt`)

**Navigation:** Add menu item to admin sidebar in `_layout.tsx`:

```tsx
<Button
  variant="ghost"
  className={cn(
    'justify-start md:w-full',
    pathname?.startsWith('/admin/email-domains') && 'bg-secondary',
  )}
  asChild
>
  <Link to="/admin/email-domains">
    <MailIcon className="mr-2 h-5 w-5" />
    <Trans>Email Domains</Trans>
  </Link>
</Button>
```

**Table component:** `apps/remix/app/components/tables/admin-email-domains-table.tsx` (optional -- can be inline in the route file like the documents page)

#### 3e. Automatic Re-registration in Sync Job (Optional Enhancement)

In the hourly sync job, after checking verification status, if a domain has been `PENDING` for more than 48 hours:

- Automatically call `reregisterEmailDomain()` to attempt recovery
- Log the auto-recovery attempt
- This provides a self-healing mechanism without user intervention

## Implementation Plan

### Phase 1: Background Sync Job (Core)

1. Create `sync-email-domains.ts` job definition with hourly cron
2. Create `sync-email-domains.handler.ts` with batch verification logic
3. Register job in `packages/lib/jobs/client.ts`
4. Add error handling and logging

### Phase 2: Schema Enhancement

5. Add `lastVerifiedAt` column to `EmailDomain` model
6. Create Prisma migration
7. Update `verifyEmailDomain()` to set `lastVerifiedAt` on each check
8. Update sync job to use `lastVerifiedAt` for intelligent scheduling

### Phase 3: Admin Email Domains Panel

9. Create `find-email-domains` admin TRPC route + types (list/search with pagination and status filter)
10. Create `get-email-domain` admin TRPC route + types (detail view with org info, emails, DNS records)
11. Register find + get routes in admin router under `emailDomain` namespace
12. Create admin list page (`admin+/email-domains._index.tsx`) with search, status filter, DataTable
13. Create admin detail page (`admin+/email-domains.$id.tsx`) with domain info, emails table, DNS records
14. Add "Email Domains" menu item to admin sidebar (`_layout.tsx`)

### Phase 4: Re-registration Feature

15. Extract `verifyDomainWithDKIM()` as a shared helper (if not already exported)
16. Create `reregisterEmailDomain()` service function
17. Create `reregister-email-domain` admin TRPC mutation route + types
18. Register reregister route in admin router under `emailDomain.reregister`
19. Add "Re-register" button + confirmation dialog on admin detail page

### Phase 5: Auto-Recovery (Optional)

20. Add 48-hour stale detection logic to sync job
21. Auto-trigger re-registration for stale domains
22. Add logging/notifications for auto-recovery events

## Files to Create/Modify

### New Files

- `packages/lib/jobs/definitions/internal/sync-email-domains.ts`
- `packages/lib/jobs/definitions/internal/sync-email-domains.handler.ts`
- `packages/ee/server-only/lib/reregister-email-domain.ts`
- `packages/trpc/server/admin-router/find-email-domains.ts`
- `packages/trpc/server/admin-router/find-email-domains.types.ts`
- `packages/trpc/server/admin-router/get-email-domain.ts`
- `packages/trpc/server/admin-router/get-email-domain.types.ts`
- `packages/trpc/server/admin-router/reregister-email-domain.ts`
- `packages/trpc/server/admin-router/reregister-email-domain.types.ts`
- `apps/remix/app/routes/_authenticated+/admin+/email-domains._index.tsx`
- `apps/remix/app/routes/_authenticated+/admin+/email-domains.$id.tsx`

### Modified Files

- `packages/prisma/schema.prisma` -- Add `lastVerifiedAt` field
- `packages/lib/jobs/client.ts` -- Register new sync job
- `packages/ee/server-only/lib/verify-email-domain.ts` -- Update `lastVerifiedAt`
- `packages/ee/server-only/lib/create-email-domain.ts` -- Export `verifyDomainWithDKIM` helper
- `packages/trpc/server/admin-router/router.ts` -- Add `emailDomain.{find, get, reregister}` routes
- `apps/remix/app/routes/_authenticated+/admin+/_layout.tsx` -- Add "Email Domains" nav item to sidebar
- New Prisma migration file

## Technical Considerations

1. **SES API Rate Limits** -- AWS SES has rate limits on `GetEmailIdentityCommand`. The sync job should process domains in batches with small delays between calls (e.g., 5-10 per batch with 1s delay).

2. **Concurrency** -- The local job provider has deterministic deduplication via SHA-256 IDs, so multiple app instances won't run the same cron tick twice.

3. **Error Isolation** -- Each domain verification in the sync job should be wrapped in try/catch so one failing domain doesn't prevent others from being checked.

4. **Re-registration Safety** -- The re-register function should be idempotent. Deleting a non-existent SES identity should be handled gracefully (already done in `deleteEmailDomain`).

5. **Private Key Security** -- The private key is encrypted at rest and should only be decrypted transiently during re-registration. It should never be logged or exposed in API responses.

6. **Feature Gating** -- The sync job should only process domains belonging to organisations with active `emailDomains` claim flags. This prevents processing domains for orgs that have downgraded.

7. **Observability** -- Add structured logging to the sync job so operations teams can monitor domain verification health across all tenants.
