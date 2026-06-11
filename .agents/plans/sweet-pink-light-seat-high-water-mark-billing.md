---
date: 2026-06-11
title: Seat High Water Mark Billing
---

# Seat High-Water-Mark Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bill organisation seats against a paid high-water mark — adds invoice immediately only above the mark, removals do nothing, and a renewal-webhook reconcile trues everything up.

**Architecture:** `organisationClaim.memberCount` becomes the paid seat high-water mark for seat-based plans, always mirroring the Stripe quantity. Grow syncs (invite acceptance) skip Stripe when the new count is within the mark and invoice immediately (`always_invoice`) above it. Removals never touch Stripe. On `customer.subscription.updated` with an advanced `current_period_start`, a reconcile sets Stripe + claim to the actual member count with `proration_behavior: 'none'` in both directions.

**Tech Stack:** TypeScript, Stripe SDK v12 (API `2022-11-15`), Prisma, vitest (`packages/lib`).

**Spec:** `docs/superpowers/specs/2026-06-11-seat-high-water-mark-billing-design.md`

**Important repo rules:** never run `npm run build` to verify (use `npx tsc --noEmit` per package); functional style only; conventional commit messages (commitlint enforced).

---

### Task 0: Commit the staged baseline

The branch `fix/update-stripe-team-member-billing` has 11 staged files (billing moved to invite-acceptance, invites removed from seat counting, error UX). Commit them as-is so later task commits are isolated.

**Files:** none created/modified — commits the existing staged set.

- [ ] **Step 1: Verify only the expected files are staged**

Run: `git status --short`

Expected: 11 staged entries (`M`/`A` in the first column), including `packages/lib/utils/billing.ts`, `packages/lib/utils/billing.test.ts` (A), `packages/ee/server-only/stripe/update-subscription-item-quantity.ts`, the three delete/leave routes, `accept-organisation-invitation.ts`, `create-organisation-member-invites.ts`, `app-error.ts`, and `organisation.invite.$token.tsx`. Nothing unexpected.

- [ ] **Step 2: Run the existing unit tests**

Run (workdir `packages/lib`): `npx vitest run utils/billing.test.ts`

Expected: PASS — 4 tests for `getSeatProrationBehaviour` (this function is replaced in later tasks; it must pass now to prove the baseline is green).

- [ ] **Step 3: Commit the staged baseline**

```bash
git commit -m "fix: bill organisation seats when invites are accepted"
```

Note: lint-staged + commitlint hooks run. If lint-staged auto-fixes files, re-stage (`git add` the same files) and commit again.

Expected: commit created; `git status --short` afterwards shows a clean tree (only untracked noise, if any).

---

### Task 1: `getSeatSyncPlan` decision helper (TDD)

Pure decision logic: given a sync mode and the paid/new seat counts, decide whether to call Stripe and with which proration behaviour. The old `getSeatProrationBehaviour` stays in place until Task 3 (its consumer is rewired there) — this task only replaces the test file and adds the new helper.

**Files:**
- Modify: `packages/lib/utils/billing.ts` (append new helper; do NOT delete `getSeatProrationBehaviour` yet)
- Modify: `packages/lib/utils/billing.test.ts` (replace entire contents)

- [ ] **Step 1: Replace the test file with the decision-matrix tests**

Replace the entire contents of `packages/lib/utils/billing.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import { getSeatSyncPlan } from './billing';

describe('getSeatSyncPlan', () => {
  describe('grow', () => {
    it('skips the sync when the new seat count is below the paid seat count', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 10, newSeatCount: 9 })).toEqual({
        shouldSync: false,
      });
    });

    it('skips the sync when the new seat count equals the paid seat count', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 10, newSeatCount: 10 })).toEqual({
        shouldSync: false,
      });
    });

    it('invoices immediately when the new seat count exceeds the paid seat count', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 10, newSeatCount: 11 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'always_invoice',
      });
    });

    it('invoices immediately on the first seat above a single paid seat', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 1, newSeatCount: 2 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'always_invoice',
      });
    });
  });

  describe('reconcile', () => {
    it('syncs downward without prorations so no credits are issued', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 10, newSeatCount: 7 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'none',
      });
    });

    it('syncs upward without prorations so drift is healed without retroactive charges', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 10, newSeatCount: 12 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'none',
      });
    });

    it('syncs at equal counts so a drifted stripe quantity is still corrected', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 10, newSeatCount: 10 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'none',
      });
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (workdir `packages/lib`): `npx vitest run utils/billing.test.ts`

Expected: FAIL — `getSeatSyncPlan` is not exported from `./billing` (SyntaxError/undefined import).

- [ ] **Step 3: Implement `getSeatSyncPlan`**

Append to `packages/lib/utils/billing.ts` (after the existing `getSeatProrationBehaviour` function — leave that function untouched for now):

```ts
export type SeatSyncMode = 'grow' | 'reconcile';

export type GetSeatSyncPlanOptions = {
  mode: SeatSyncMode;

  /**
   * The seat count already paid for in the current billing period. For
   * seat-based plans this is `organisationClaim.memberCount`, which mirrors
   * the Stripe subscription item quantity.
   */
  paidSeatCount: number;

  /**
   * The proposed total member count.
   */
  newSeatCount: number;
};

export type SeatSyncPlan =
  | { shouldSync: false }
  | { shouldSync: true; prorationBehaviour: 'always_invoice' | 'none' };

/**
 * Decides whether and how a seat count change should be synced with Stripe.
 *
 * - Grow (member added): seats within the paid high-water mark are free, the
 *   organisation already paid for them this billing period. Seats above the
 *   mark are invoiced immediately (`always_invoice`) on monthly and yearly
 *   plans alike.
 * - Reconcile (billing period advanced): always syncs to the actual member
 *   count with `none` in both directions. No credits are issued when
 *   shrinking and no retroactive charges are created when healing upward
 *   drift (e.g. unbilled SSO portal joins). Equal counts still sync so a
 *   drifted Stripe quantity is corrected; the Stripe update helper no-ops
 *   when the quantity already matches.
 */
export const getSeatSyncPlan = ({ mode, paidSeatCount, newSeatCount }: GetSeatSyncPlanOptions): SeatSyncPlan => {
  if (mode === 'grow' && newSeatCount <= paidSeatCount) {
    return { shouldSync: false };
  }

  return {
    shouldSync: true,
    prorationBehaviour: mode === 'grow' ? 'always_invoice' : 'none',
  };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (workdir `packages/lib`): `npx vitest run utils/billing.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/utils/billing.ts packages/lib/utils/billing.test.ts
git commit -m "feat: add seat sync plan decision helper"
```

---

### Task 2: Removals do nothing

Remove the Stripe seat sync (and now-unneeded queries) from all three member-removal paths. The claim and Stripe quantity intentionally stay at the paid high-water mark. `syncMemberCountWithStripeSeatPlan`'s signature is unchanged in this task, so everything still compiles; after this task its only remaining caller is the invite-acceptance path.

**Files:**
- Modify: `packages/trpc/server/organisation-router/delete-organisation-members.ts`
- Modify: `packages/trpc/server/organisation-router/leave-organisation.ts`
- Modify: `packages/trpc/server/admin-router/delete-organisation-member.ts`

- [ ] **Step 1: Edit `delete-organisation-members.ts`**

Remove the import on line 1:

```ts
import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
```

In the `prisma.organisation.findFirst` include block, remove the `subscription: true,` and `organisationClaim: true,` lines (keep `teams` and `members` — `members` is still used to resolve `membersToDelete`).

Remove these lines between the `if (!organisation)` guard and the `membersToDelete` assignment / transaction:

```ts
  const { organisationClaim } = organisation;
```

```ts
  const newMemberCount = organisation.members.length - membersToDelete.length;

  // Removing members is a reducing operation, so we don't gate it on the
  // subscription being present. Sync Stripe only when one exists.
  if (organisation.subscription) {
    await syncMemberCountWithStripeSeatPlan(organisation.subscription, organisationClaim, newMemberCount);
  }
```

Add this comment above the `membersToDelete` assignment so the intent is recorded:

```ts
  // Removing members never touches billing: the organisation keeps the seats
  // it already paid for (high-water mark). The renewal reconcile trues the
  // Stripe quantity up with the actual member count.
```

- [ ] **Step 2: Edit `leave-organisation.ts`**

Remove the import on line 1 (same import as above).

In the include block, remove `organisationClaim: true,`, `subscription: true,` and the whole `members` include (it was only used for the seat count):

```ts
        members: {
          select: {
            id: true,
          },
        },
```

(keep the `teams` include).

Remove:

```ts
    const { organisationClaim } = organisation;

    const newMemberCount = organisation.members.length - 1;

    // Leaving is a reducing operation, so we don't gate it on the subscription
    // being present. Sync Stripe only when one exists.
    if (organisation.subscription) {
      await syncMemberCountWithStripeSeatPlan(organisation.subscription, organisationClaim, newMemberCount);
    }
```

Replace with:

```ts
    // Leaving never touches billing: the organisation keeps the seats it
    // already paid for (high-water mark). The renewal reconcile trues the
    // Stripe quantity up with the actual member count.
```

- [ ] **Step 3: Edit admin `delete-organisation-member.ts`**

Remove the import on line 1 (same import as above).

In the include block, remove `subscription: true,` and `organisationClaim: true,` (keep `teams` and `members` — `members` resolves `memberToDelete`).

Remove:

```ts
    const newMemberCount = organisation.members.length - 1;

    // Removing a member is a reducing operation, so we don't gate it on the
    // subscription being present. Sync Stripe only when one exists.
    if (organisation.subscription) {
      await syncMemberCountWithStripeSeatPlan(
        organisation.subscription,
        organisation.organisationClaim,
        newMemberCount,
      );
    }
```

Replace with:

```ts
    // Removing a member never touches billing: the organisation keeps the
    // seats it already paid for (high-water mark). The renewal reconcile
    // trues the Stripe quantity up with the actual member count.
```

- [ ] **Step 4: Type-check the trpc package**

Run (workdir `packages/trpc`): `npx tsc --noEmit`

Expected: zero NEW errors in the three edited files (unused imports/variables would surface here). If pre-existing unrelated errors appear elsewhere, note them and proceed.

- [ ] **Step 5: Commit**

```bash
git add packages/trpc/server/organisation-router/delete-organisation-members.ts packages/trpc/server/organisation-router/leave-organisation.ts packages/trpc/server/admin-router/delete-organisation-member.ts
git commit -m "fix: stop syncing stripe seats when members are removed"
```

---

### Task 3: Mode-based sync in the Stripe helpers + grow path

Thread `SeatSyncMode` through `syncMemberCountWithStripeSeatPlan` → `updateSubscriptionItemQuantity`, delete the direction/interval-based `getSeatProrationBehaviour`, and pass `'grow'` from the invite-acceptance path. After this task the proration behaviour is decided exclusively by `getSeatSyncPlan`.

**Files:**
- Modify: `packages/ee/server-only/stripe/update-subscription-item-quantity.ts`
- Modify: `packages/lib/server-only/organisation/accept-organisation-invitation.ts:105`
- Modify: `packages/lib/utils/billing.ts` (delete `getSeatProrationBehaviour` + its types)

- [ ] **Step 1: Rewrite `updateSubscriptionItemQuantity` and `syncMemberCountWithStripeSeatPlan`**

In `packages/ee/server-only/stripe/update-subscription-item-quantity.ts`:

Replace the imports at the top of the file:

```ts
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import type { SeatSyncMode } from '@documenso/lib/utils/billing';
import { getSeatSyncPlan } from '@documenso/lib/utils/billing';
import { appLog } from '@documenso/lib/utils/debugger';
import { prisma } from '@documenso/prisma';
import type { OrganisationClaim, Subscription } from '@prisma/client';
import type Stripe from 'stripe';

import { isPriceSeatsBased } from './is-price-seats-based';
```

Replace `UpdateSubscriptionItemQuantityOptions` and `updateSubscriptionItemQuantity` with:

```ts
export type UpdateSubscriptionItemQuantityOptions = {
  subscriptionId: string;
  quantity: number;
  priceId: string;
  prorationBehaviour: 'always_invoice' | 'none';
};

export const updateSubscriptionItemQuantity = async ({
  subscriptionId,
  quantity,
  priceId,
  prorationBehaviour,
}: UpdateSubscriptionItemQuantityOptions) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const items = subscription.items.data.filter((item) => item.price.id === priceId);

  if (items.length !== 1) {
    throw new Error('Subscription does not contain required item');
  }

  const oldQuantity = items[0].quantity;

  if (oldQuantity === quantity) {
    return;
  }

  const subscriptionUpdatePayload: Stripe.SubscriptionUpdateParams = {
    items: items.map((item) => ({
      id: item.id,
      quantity,
    })),
    proration_behavior: prorationBehaviour,
  };

  await stripe.subscriptions.update(subscriptionId, subscriptionUpdatePayload);
};
```

(`hasYearlyItem` and the old proration block are gone; `assertMemberCountWithinCap` stays exactly as-is.)

Replace `syncMemberCountWithStripeSeatPlan` with:

```ts
/**
 * Syncs the organisation's member count with the Stripe subscription quantity.
 *
 * For seat-based plans, `organisationClaim.memberCount` is the paid seat
 * high-water mark for the current billing period and always mirrors the
 * Stripe quantity.
 *
 * - Mode `grow`: skips entirely while the new count is within the paid
 *   high-water mark (the seat is already paid for); above it, the increase
 *   is invoiced immediately.
 * - Mode `reconcile`: writes the actual member count with no prorations in
 *   either direction (renewal-time true-up).
 *
 * No-ops for plans that are not seats-based and for organisations with
 * unlimited seats (`organisationClaim.memberCount === 0`).
 *
 * @param subscription - The subscription to sync the member count with.
 * @param organisationClaim - The organisation claim.
 * @param quantity - The new total member count to sync.
 * @param mode - Whether this is a grow operation or a renewal reconcile.
 */
export const syncMemberCountWithStripeSeatPlan = async (
  subscription: Subscription,
  organisationClaim: OrganisationClaim,
  quantity: number,
  mode: SeatSyncMode,
) => {
  // Infinite seats means no sync needed. This guard must run before the
  // high-water comparison, otherwise unlimited plans would always sync.
  if (organisationClaim.memberCount === 0) {
    return;
  }

  const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

  if (!isSeatsBased) {
    return;
  }

  const seatSyncPlan = getSeatSyncPlan({
    mode,
    paidSeatCount: organisationClaim.memberCount,
    newSeatCount: quantity,
  });

  // Seats within the paid high-water mark are already covered for this
  // billing period: no Stripe call, and the claim keeps the high-water mark.
  if (!seatSyncPlan.shouldSync) {
    return;
  }

  appLog('BILLING', `Updating seat based plan (${mode})`);

  await updateSubscriptionItemQuantity({
    priceId: subscription.priceId,
    subscriptionId: subscription.planId,
    quantity,
    prorationBehaviour: seatSyncPlan.prorationBehaviour,
  });

  // The claim mirrors the Stripe quantity (the paid seat high-water mark).
  // This should be automatically updated after the Stripe webhook is fired
  // but we just manually adjust it here as well to avoid any race conditions.
  await prisma.organisationClaim.update({
    where: {
      id: organisationClaim.id,
    },
    data: {
      memberCount: quantity,
    },
  });
};
```

- [ ] **Step 2: Pass `'grow'` from the invite-acceptance path**

In `packages/lib/server-only/organisation/accept-organisation-invitation.ts`, change:

```ts
    if (subscription) {
      await syncMemberCountWithStripeSeatPlan(subscription, organisationClaim, newMemberCount);
    }
```

to:

```ts
    if (subscription) {
      await syncMemberCountWithStripeSeatPlan(subscription, organisationClaim, newMemberCount, 'grow');
    }
```

- [ ] **Step 3: Delete `getSeatProrationBehaviour` from `billing.ts`**

In `packages/lib/utils/billing.ts`, delete the `GetSeatProrationBehaviourOptions` type, the `getSeatProrationBehaviour` function, and their doc comments entirely (everything between `validateIfSubscriptionIsRequired` and the `SeatSyncMode` type added in Task 1).

- [ ] **Step 4: Verify no references to the deleted function remain**

Run (workdir repo root): `grep -rn "getSeatProrationBehaviour" packages apps`

Expected: no matches.

- [ ] **Step 5: Run unit tests and type-check**

Run (workdir `packages/lib`): `npx vitest run utils/billing.test.ts` — Expected: PASS (7 tests).

Run (workdir `packages/lib`): `npx tsc --noEmit` — Expected: zero NEW errors.

Run (workdir `packages/ee`): `npx tsc --noEmit` — Expected: zero NEW errors.

- [ ] **Step 6: Commit**

```bash
git add packages/ee/server-only/stripe/update-subscription-item-quantity.ts packages/lib/server-only/organisation/accept-organisation-invitation.ts packages/lib/utils/billing.ts
git commit -m "fix: skip stripe sync for seats within the paid high-water mark"
```

---

### Task 4: Renewal reconcile + claim-clobber guard

Two webhook-side changes in `onSubscriptionUpdated`: (a) when a plan/claim change overwrites the organisation claim, preserve the billed quantity as the high-water mark instead of resetting it to the claim template; (b) when the billing period advances, reconcile the Stripe quantity and claim with the actual member count.

**Files:**
- Modify: `packages/ee/server-only/stripe/update-subscription-item-quantity.ts` (append `reconcileSeatsWithMemberCount`)
- Modify: `packages/ee/server-only/stripe/webhook/on-subscription-updated.ts`

- [ ] **Step 1: Add `reconcileSeatsWithMemberCount` to `update-subscription-item-quantity.ts`**

Add `SubscriptionStatus` as a value import in that file — change:

```ts
import type { OrganisationClaim, Subscription } from '@prisma/client';
```

to:

```ts
import type { OrganisationClaim, Subscription } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
```

Append at the end of the file:

```ts
/**
 * Reconciles the Stripe seat quantity and organisation claim with the actual
 * member count at the start of a new billing period.
 *
 * Called from the `customer.subscription.updated` webhook when the billing
 * period advances. The renewal invoice has already been generated at the
 * previous (high-water) quantity by then — the reconciled count takes effect
 * on the next invoice (accepted trade-off: removed seats bill for exactly
 * one extra period).
 *
 * Runs with no prorations in either direction: no credits when shrinking,
 * no retroactive charges when healing upward drift (e.g. unbilled SSO
 * portal joins or lost grow races).
 */
export const reconcileSeatsWithMemberCount = async (organisationId: string) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      subscription: true,
      organisationClaim: true,
    },
  });

  if (!organisation || !organisation.subscription) {
    return;
  }

  // A canceled subscription cannot have its quantity updated in Stripe.
  if (organisation.subscription.status !== SubscriptionStatus.ACTIVE) {
    return;
  }

  const memberCount = await prisma.organisationMember.count({
    where: {
      organisationId,
    },
  });

  // An organisation always has at least its owner; never sync a zero
  // quantity into Stripe.
  if (memberCount === 0) {
    return;
  }

  await syncMemberCountWithStripeSeatPlan(
    organisation.subscription,
    organisation.organisationClaim,
    memberCount,
    'reconcile',
  );
};
```

- [ ] **Step 2: Wire both changes into `on-subscription-updated.ts`**

Add two imports after the existing imports (`createOrganisationClaimUpsertData`, etc.):

```ts
import { isPriceSeatsBased } from '../is-price-seats-based';
import { reconcileSeatsWithMemberCount } from '../update-subscription-item-quantity';
```

Immediately before the `await prisma.$transaction(async (tx) => {` line, add:

```ts
  // Only fetched when the claim is being overwritten (plan change).
  const isUpdatedPriceSeatsBased =
    !bypassClaimUpdate && newClaimFound ? await isPriceSeatsBased(updatedItem.price.id) : false;
```

Inside the transaction, replace the claim-overwrite block:

```ts
    // Override current organisation claim if new one is found.
    // Skipped when bypassClaimUpdate is set.
    if (!bypassClaimUpdate && newClaimFound) {
      await tx.organisationClaim.update({
        where: {
          id: organisation.organisationClaim.id,
        },
        data: {
          originalSubscriptionClaimId: updatedSubscriptionClaim.id,
          ...createOrganisationClaimUpsertData(updatedSubscriptionClaim),
        },
      });
    }
```

with:

```ts
    // Override current organisation claim if new one is found.
    // Skipped when bypassClaimUpdate is set.
    if (!bypassClaimUpdate && newClaimFound) {
      const claimUpsertData = createOrganisationClaimUpsertData(updatedSubscriptionClaim);

      // For seat-based plans the claim's memberCount is the paid seat
      // high-water mark mirroring the Stripe quantity. Preserve the billed
      // quantity instead of resetting to the claim template value. An
      // unlimited template (0) stays unlimited.
      if (isUpdatedPriceSeatsBased && claimUpsertData.memberCount !== 0) {
        claimUpsertData.memberCount = updatedItem.quantity ?? 1;
      }

      await tx.organisationClaim.update({
        where: {
          id: organisation.organisationClaim.id,
        },
        data: {
          originalSubscriptionClaimId: updatedSubscriptionClaim.id,
          ...claimUpsertData,
        },
      });
    }
```

After the closing `});` of the `prisma.$transaction` call (end of the function body), add:

```ts
  // When the billing period advances (renewal), reconcile the seat quantity
  // and claim with the actual member count. The renewal invoice was already
  // generated at the high-water quantity; the reconciled count applies from
  // the next invoice. Anchor resets also land here, where the absolute
  // write is harmless. Runs after the transaction so the reconciled values
  // win over any claim overwrite above.
  const previousPeriodStart = previousAttributes?.current_period_start;

  const hasPeriodAdvanced =
    typeof previousPeriodStart === 'number' && subscription.current_period_start > previousPeriodStart;

  if (hasPeriodAdvanced && status === SubscriptionStatus.ACTIVE) {
    await reconcileSeatsWithMemberCount(organisation.id);
  }
```

(`status` and `SubscriptionStatus` already exist in this file; `previousAttributes` is already a parameter typed `Partial<Stripe.Subscription> | null`, and `current_period_start` is a top-level number on API version `2022-11-15`.)

- [ ] **Step 3: Type-check**

Run (workdir `packages/ee`): `npx tsc --noEmit`

Expected: zero NEW errors. If `claimUpsertData.memberCount` is reported read-only, the return type of `createOrganisationClaimUpsertData` has changed since planning — fix by building the object literal with a conditional spread instead:

```ts
      const claimUpsertData = {
        ...createOrganisationClaimUpsertData(updatedSubscriptionClaim),
        ...(isUpdatedPriceSeatsBased && updatedSubscriptionClaim.memberCount !== 0
          ? { memberCount: updatedItem.quantity ?? 1 }
          : {}),
      };
```

- [ ] **Step 4: Run the unit test suite**

Run (workdir `packages/lib`): `npx vitest run`

Expected: PASS — all suites (billing, sanitize-branding-css, field-canvas-style, webhook URL tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ee/server-only/stripe/update-subscription-item-quantity.ts packages/ee/server-only/stripe/webhook/on-subscription-updated.ts
git commit -m "feat: reconcile stripe seats with member count at period advance"
```

---

### Task 5: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Unit tests**

Run (workdir `packages/lib`): `npx vitest run`

Expected: PASS, including the 7 `getSeatSyncPlan` tests.

- [ ] **Step 2: Type-check all touched packages**

Run (workdir `packages/lib`): `npx tsc --noEmit`
Run (workdir `packages/ee`): `npx tsc --noEmit`
Run (workdir `packages/trpc`): `npx tsc --noEmit`

Expected: zero NEW errors versus the baseline (re-run on the baseline commit to compare if unsure).

- [ ] **Step 3: Confirm the final call-site inventory**

Run (workdir repo root): `grep -rn "syncMemberCountWithStripeSeatPlan" packages apps`

Expected: exactly 3 non-definition references — the import + call in `accept-organisation-invitation.ts` (mode `'grow'`) and the call inside `reconcileSeatsWithMemberCount` (mode `'reconcile'`). No removal route references.

Run (workdir repo root): `grep -rn "getSeatProrationBehaviour" packages apps`

Expected: no matches.

- [ ] **Step 4: Clean tree check**

Run: `git status --short`

Expected: clean (all work committed across Tasks 0-4).

- [ ] **Step 5 (manual, optional but recommended): Stripe CLI smoke test**

With billing enabled locally (`NEXT_PRIVATE_STRIPE_API_KEY`, webhook secret, `stripe listen --forward-to localhost:3000/api/stripe/webhook`):

1. Seat org with quantity 3 and 3 members → accept an invite → Stripe quantity 4, immediate invoice, claim `memberCount` 4.
2. Remove a member → no Stripe event, claim stays 4.
3. Accept another invite (back to 4 members) → no Stripe call, no invoice.
4. Advance the billing period with a test clock (or `stripe trigger customer.subscription.updated` with a modified `current_period_start` previous attribute) → quantity and claim reconcile to 4, no proration line items.
5. Switch plans (different price with a claim) → claim `memberCount` preserves the quantity, not the template value.