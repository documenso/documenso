# Seat High-Water-Mark Billing — Design

**Date:** 2026-06-11
**Branch:** `fix/update-stripe-team-member-billing`
**Status:** Approved (pending spec review)

## Problem

Documenso bills seat-based organisation plans by syncing the Stripe subscription
item quantity with the member count. The in-flight branch moves billing from
invite-creation to invite-acceptance and stops counting pending invites as
seats. However, it shrinks the Stripe quantity when members are removed
(`proration_behavior: 'none'`) and grows it when members are added
(`always_invoice` / default prorations). Stripe computes prorations purely from
the quantity delta at call time, so an organisation that removes a member and
later adds one pays twice for the same seat within one billing period.

## Billing rules (agreed)

1. **Member added:** if the seat is not already paid for, invoice the prorated
   charge immediately — on monthly *and* yearly plans (`always_invoice`).
2. **Member removed:** do nothing. No Stripe call, no credit, no refund.
3. **Member added after a removal:** if the new member count is within the
   already-paid seat count, add the member without any Stripe call or charge.
4. **Reconcile at period advance:** when the subscription renews, sync the
   Stripe quantity and the claim to the actual member count.

### Accepted trade-offs

- **One extra period for removed seats (all intervals).** The renewal invoice
  is generated before the period-advance webhook fires, so a removed seat is
  billed for exactly one more period (a month on monthly plans, a year on
  yearly plans) and drops off the invoice after that. Explicitly accepted.
- **SSO portal joins remain unbilled** at join time (out of scope). The
  bidirectional reconcile trues them up at the next renewal with no
  retroactive charge.
- **Concurrent-accept race** (two simultaneous accepts computing the same
  member count) can under-bill by a seat until the next grow or reconcile.
  Accepted; the reconcile self-heals it.

## State model

For **seat-based plans**, `organisationClaim.memberCount` is the **paid seat
high-water mark** for the current billing period. The Stripe subscription item
quantity always equals it after any sync. Invariants:

- `memberCount === 0` continues to mean **unlimited** — every sync and the
  reconcile no-op. This guard runs **before** the high-water comparison
  (otherwise `newCount <= 0` would never skip).
- For **non-seat capped plans**, `memberCount` keeps its existing meaning (hard
  cap from the claim) and is never modified by any flow below
  (`isPriceSeatsBased` guards remain).
- Actual headcount is `organisation.members.length`. Pending invites never
  count toward billing (already in the branch).

## Flows

### 1. Member added — `acceptOrganisationInvitation`

Unchanged from the branch: `SUBSCRIPTION_INACTIVE` thrown for inactive
subscriptions, `assertMemberCountWithinCap` enforces the cap (null
subscription supported), billing runs **before** the member row is created so
a Stripe failure means no member is added.

New seat logic (inside `syncMemberCountWithStripeSeatPlan`, mode `'grow'`):

- `newMemberCount = members.length + 1`
- Skip if unlimited, non-seat plan, or no subscription (existing guards).
- **Skip Stripe and leave the claim untouched when
  `newMemberCount <= organisationClaim.memberCount`** — the seat is already
  paid. (`<=`, not `<`: at equality the quantity already matches.)
- Otherwise update the Stripe quantity with `proration_behavior:
  'always_invoice'` (all intervals) and set
  `organisationClaim.memberCount = newMemberCount`.

### 2. Member removed — nothing

Remove the `syncMemberCountWithStripeSeatPlan` calls and the now-unneeded
subscription/claim/member includes from:

- `packages/trpc/server/organisation-router/delete-organisation-members.ts`
- `packages/trpc/server/organisation-router/leave-organisation.ts`
- `packages/trpc/server/admin-router/delete-organisation-member.ts`

(`delete-organisation-member-invites.ts` already does no billing on the
branch.) Claim and Stripe stay at the high-water mark.

### 3. Reconcile — `onSubscriptionUpdated` webhook

Trigger: `previous_attributes.current_period_start` is present on the
`customer.subscription.updated` event (period advance; also fires on anchor
resets, where reconciling is harmless because it writes absolute values).

Conditions: subscription mapped to an organisation, new status `ACTIVE`,
seat-based price, `claim.memberCount !== 0`.

Action: count actual `OrganisationMember` rows, then sync **bidirectionally**
with mode `'reconcile'`:

- Set Stripe quantity to the actual count with `proration_behavior: 'none'`
  (no credits when lower, no retroactive charge when higher).
- Set `organisationClaim.memberCount` to the actual count.
- Runs **after** the existing subscription-row update and claim-overwrite
  logic so the reconcile result wins.

Idempotent by construction (absolute quantity write + Stripe webhook retries).

### 4. Proration is mode-based, not direction-based

The reconcile makes direction-based proration wrong (an upward reconcile must
not invoice). Replace `getSeatProrationBehaviour({ oldQuantity, newQuantity,
isYearly })` with an explicit mode threaded through the call chain:

| Mode | Proration | Used by |
| --- | --- | --- |
| `'grow'` | `always_invoice` | invite acceptance |
| `'reconcile'` | `none` | renewal webhook |

`isYearly` disappears. `updateSubscriptionItemQuantity` keeps its
`oldQuantity === quantity` early-return and takes the proration behaviour (or
mode) from the caller.

### 5. Claim-clobber guard

In `onSubscriptionUpdated`, a plan/claim change (`newClaimFound`) overwrites
the organisation claim with `createOrganisationClaimUpsertData(claim)`,
resetting `memberCount` to the claim **template** value and corrupting the
high-water mark (a too-large template lets adds skip billing until the next
renewal). Guard: when the updated price is seat-based, override the upserted
`memberCount` with the subscription item quantity from the webhook payload
(`updatedItem.quantity ?? 1`) instead of the template value. Non-seat plans
keep template semantics.

## Affected files

| File | Change |
| --- | --- |
| `packages/lib/utils/billing.ts` | Replace `getSeatProrationBehaviour` with mode-based decision helper(s) |
| `packages/lib/utils/billing.test.ts` | Rewrite for the skip/sync/mode matrix |
| `packages/ee/server-only/stripe/update-subscription-item-quantity.ts` | Caller-provided proration; `syncMemberCountWithStripeSeatPlan` gains mode + grow-skip check |
| `packages/lib/server-only/organisation/accept-organisation-invitation.ts` | Pass mode `'grow'` (otherwise unchanged) |
| `packages/trpc/server/organisation-router/delete-organisation-members.ts` | Remove billing sync + trim query |
| `packages/trpc/server/organisation-router/leave-organisation.ts` | Remove billing sync + trim query |
| `packages/trpc/server/admin-router/delete-organisation-member.ts` | Remove billing sync + trim query |
| `packages/ee/server-only/stripe/webhook/on-subscription-updated.ts` | Period-advance reconcile + claim-clobber guard |

## Error handling

- Accept path: Stripe/cap failures throw `AppError`s before the member is
  created; the invite page renders `CapExceeded` / `SubscriptionInactive` /
  `Unknown` (already on the branch).
- Reconcile path: failures propagate as webhook 500s; Stripe retries; the
  write is idempotent.
- Inactive subscriptions are never reconciled (cannot update a canceled
  Stripe subscription) and cannot accept members.

## Testing

- **Vitest** (`billing.test.ts`): decision matrix — grow within mark skips;
  grow above mark syncs with `always_invoice`; reconcile syncs with `none` in
  both directions; unlimited (`0`) always no-ops; equality skips.
- **Manual (Stripe CLI / test clock):** accept→invoice, remove→no event,
  remove→accept→no charge, period advance→reconcile down, SSO-drift→reconcile
  up, plan change→claim guard preserves quantity.
- E2E suites run with billing disabled; no E2E changes.

## Out of scope

SSO-join billing, draft-invoice editing, subscription schedules, `PAST_DUE`
gating at accept, `invoice.upcoming`, flexible billing mode migration.
