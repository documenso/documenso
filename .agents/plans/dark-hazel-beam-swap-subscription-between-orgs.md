---
date: 2026-03-04
title: Swap Subscription Between Orgs
---

## Overview

Add the ability for admins to move a subscription (and its associated Stripe customerId) from one organisation to another, when viewing a user in the admin panel. The target org must be owned by the same user and must be on the free plan (no existing active subscription).

## Context & Data Model

- `Organisation` has a 1:1 optional `Subscription` and a `customerId` (Stripe customer ID, `@unique`)
- `Organisation` has a 1:1 `OrganisationClaim` that tracks entitlements (team count, member count, feature flags)
- `Subscription` also stores a redundant `customerId` and has `organisationId` (`@unique`)
- When a subscription is removed from an org, its `OrganisationClaim` should be reset to the FREE claim
- Relationship chain: `User --owns--> Organisation --has--> Subscription + OrganisationClaim`

## Constraints

- **paid → free only**: The target org must NOT have an active subscription (status ACTIVE or PAST_DUE). It must be on the free plan.
- **same owner**: Both source and target orgs must be owned by the same user (the user being viewed).
- The `customerId` must move with the subscription to the target org (cleared from source, set on target).
- The Stripe subscription object itself is NOT modified — only the DB-level mapping changes. The Stripe customer stays the same; we just reassociate it to a different org.

## Implementation Plan

### 1. Backend: TRPC Admin Route

**Files to create:**

- `packages/trpc/server/admin-router/swap-organisation-subscription.types.ts`
- `packages/trpc/server/admin-router/swap-organisation-subscription.ts`

**Request schema (`ZSwapOrganisationSubscriptionRequestSchema`):**

```ts
z.object({
  sourceOrganisationId: z.string(),
  targetOrganisationId: z.string(),
});
```

**Response schema:** `z.void()`

**Route logic (in a single `prisma.$transaction`):**

1. Fetch source org with `subscription` + `organisationClaim`
2. Fetch target org with `subscription` + `organisationClaim`
3. Validate:
   - Source org has an active subscription (status `ACTIVE` or `PAST_DUE`)
   - Target org does NOT have an active subscription (no subscription record, or status `INACTIVE`)
   - Both orgs have the same `ownerUserId`
4. In a transaction:
   a. Clear `customerId` on source org (set to `null`)
   b. Set `customerId` on target org to the source's `customerId`
   c. Move the `Subscription` record: update `organisationId` to target org ID
   d. Copy the source org's `OrganisationClaim` entitlements to the target org's `OrganisationClaim` (`originalSubscriptionClaimId`, `teamCount`, `memberCount`, `envelopeItemCount`, `flags`)
   e. Reset the source org's `OrganisationClaim` to the FREE claim (using `createOrganisationClaimUpsertData(internalClaims[INTERNAL_CLAIM_ID.FREE])` pattern from `on-subscription-deleted.ts`)

**Note on ordering:** Because `Organisation.customerId` is `@unique`, we must clear the source first, then set the target — or do both in a transaction that handles the constraint. Prisma transactions handle this correctly as they apply all writes atomically.

**Register the route:**

- Import in `packages/trpc/server/admin-router/router.ts`
- Add under `organisation` as `swapSubscription`
- Call path: `trpc.admin.organisation.swapSubscription`

### 2. Frontend: Dialog Component

**File to create:**

- `apps/remix/app/components/dialogs/admin-swap-subscription-dialog.tsx`

**Props:**

```ts
type AdminSwapSubscriptionDialogProps = {
  trigger?: React.ReactNode;
  sourceOrganisationId: string;
  sourceOrganisationName: string;
  userId: number;
} & Omit<DialogPrimitive.DialogProps, 'children'>;
```

**Dialog behavior:**

1. Opens when the trigger is clicked (from the organisations table actions dropdown)
2. Fetches the user's owned orgs via `trpc.admin.organisation.find.useQuery({ ownerUserId: userId })`
3. Filters to only show orgs that are on the free plan (no active subscription) and excludes the source org
4. Displays a select dropdown to pick the target org
5. Shows a warning alert: "This will move the subscription from {source} to {target}. The source organisation will be reset to the free plan."
6. On submit, calls `trpc.admin.organisation.swapSubscription.useMutation()`
7. On success, shows a toast, invalidates relevant queries, and closes the dialog

**UI layout (following existing dialog patterns like `admin-organisation-create-dialog.tsx`):**

- `DialogHeader` with title "Move Subscription" and description
- A select dropdown listing eligible target orgs (name + url)
- An `Alert` explaining what will happen
- `DialogFooter` with Cancel + "Move Subscription" buttons (submit button uses `loading` prop)

### 3. Frontend: Wire into the Organisations Table

**File to modify:**

- `apps/remix/app/components/tables/admin-organisations-table.tsx`

**Changes:**

- Import the `AdminSwapSubscriptionDialog`
- Add a new prop `ownerUserId?: number` to `AdminOrganisationsTableOptions` (needed so the dialog can query other owned orgs)
- Add a new dropdown menu item in the actions column: "Move Subscription" with `ArrowRightLeftIcon` from lucide
- Only render this item when the org row has an active subscription (`subscription?.status === 'ACTIVE' || subscription?.status === 'PAST_DUE'`)
- The menu item renders inside `AdminSwapSubscriptionDialog` with `trigger` prop as the menu item

### 4. Frontend: Pass userId from User Detail Page

**File to modify:**

- `apps/remix/app/routes/_authenticated+/admin+/users.$id.tsx`

**Changes:**

- Pass `ownerUserId={user.id}` to `<AdminOrganisationsTable>` so it can forward this to the swap dialog

## File Change Summary

| File                                                                        | Action     | Description                                                |
| --------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `packages/trpc/server/admin-router/swap-organisation-subscription.types.ts` | **Create** | Request/response Zod schemas + TS types                    |
| `packages/trpc/server/admin-router/swap-organisation-subscription.ts`       | **Create** | Admin mutation with prisma transaction                     |
| `packages/trpc/server/admin-router/router.ts`                               | **Modify** | Register route at `organisation.swapSubscription`          |
| `apps/remix/app/components/dialogs/admin-swap-subscription-dialog.tsx`      | **Create** | Dialog for selecting target org                            |
| `apps/remix/app/components/tables/admin-organisations-table.tsx`            | **Modify** | Add "Move Subscription" action + accept `ownerUserId` prop |
| `apps/remix/app/routes/_authenticated+/admin+/users.$id.tsx`                | **Modify** | Pass `ownerUserId={user.id}` to table                      |

## Edge Cases & Considerations

1. **Stripe customer stays the same**: The Stripe subscription is tied to a Stripe customer. We move the `customerId` to the target org, so webhook lookups (`findFirst where customerId`) will correctly resolve to the target org going forward.

2. **`@unique` constraint on `Organisation.customerId`**: Must clear source before setting target within the transaction. Prisma interactive transactions handle this correctly.

3. **`@unique` constraint on `Subscription.organisationId`**: Since the target org should not have a subscription record, updating the existing subscription's `organisationId` to the target should work. If the target has an INACTIVE subscription record, we need to delete it first.

4. **Target org has INACTIVE subscription**: The target org might have a stale INACTIVE subscription from a previous cancellation. In this case, delete the target's old subscription record before moving the source's subscription over.

5. **Seat-based plans**: If the subscription is seat-based, the Stripe quantity may not match the target org's member count. Consider calling `syncMemberCountWithStripeSeatPlan` after the swap as a post-transaction step.

6. **OrganisationClaim transfer**: Copy `originalSubscriptionClaimId`, `teamCount`, `memberCount`, `envelopeItemCount`, and `flags` from source claim to target claim. Reset source claim to FREE.

7. **No Stripe API calls needed**: This is purely a DB-level reassociation. The Stripe subscription, customer, and payment method all remain unchanged.
