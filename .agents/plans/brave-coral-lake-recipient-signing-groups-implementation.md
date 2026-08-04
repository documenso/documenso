---
date: 2026-08-04
title: Recipient Signing Groups Implementation
---

# Recipient Signing Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow recipients to share a `signingOrder` value ("signing groups") in the V2 envelope editor so grouped recipients sign in any order among themselves, gating the next step until all members complete.

**Architecture:** Groups are derived from duplicate `signingOrder` values — no schema change (`Recipient.signingOrder` is already a nullable, non-unique `Int`). Pure group utilities live in `packages/lib/utils/recipient-groups.ts` and are shared by the editor UI and the server signing flow. The editor renders steps as cards with nested Kanban drag-and-drop (`@hello-pangea/dnd`: outer STEP droppable with combine, inner RECIPIENT droppables, gap drop-zones). Server "single next recipient" decision points switch to group semantics (value-based turn check, min-order group activation).

**Tech Stack:** TypeScript, React (Remix), react-hook-form, Zod, `@hello-pangea/dnd`, Prisma, tRPC, vitest, Playwright.

**Spec:** `.agents/plans/quiet-jade-river-recipient-signing-groups.md` — read it first.

**Repo rules that apply to every task:** no classes, `type` over `interface`, named exports, no 1-line `if` statements, `<Trans>`/`` t` ` ``/`plural` macros for all user-facing strings, `const Component = () => {}` for components.

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `packages/lib/utils/recipient-groups.ts` | Create | Pure group derivation, normalization, editor operations, turn predicate, dictation helper |
| `packages/lib/utils/recipient-groups.test.ts` | Create | Unit tests for all of the above |
| `packages/lib/utils/recipients.ts` | Modify | Group-aware `isAssistantLastSigner`, new `canEditorRecipientBeModified` |
| `packages/lib/utils/recipients.test.ts` | Modify | Tests for group-aware assistant check |
| `packages/lib/server-only/recipient/get-is-recipient-turn.ts` | Modify | Value-based turn check |
| `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts` | Modify | Delete inline turn loop, use shared predicate |
| `packages/lib/server-only/document/send-document.ts` | Modify | Notify whole first pending group |
| `packages/lib/server-only/document/complete-document-with-token.ts` | Modify | Group advance + dictation gating |
| `packages/lib/server-only/template/create-document-from-direct-template.ts` | Modify | Dictation only for single-member next step |
| `packages/lib/server-only/recipient/get-next-pending-recipient.ts` | Modify | Use `getDictatableNextRecipient` |
| `packages/lib/server-only/recipient/get-recipients-for-assistant.ts` | Modify | Strictly-greater assistant scope (self preserved) |
| `packages/trpc/server/envelope-router/sign-envelope-field.ts` | Modify | Strictly-greater assistant scope (self preserved) |
| `apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx` | Modify | Use `getDictatableNextRecipient` |
| `apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx` | Modify | Use `getDictatableNextRecipient` |
| `apps/remix/app/components/general/direct-template/direct-template-signing-form.tsx` | Modify | Use `getDictatableNextRecipient` |
| `packages/lib/client-only/hooks/use-editor-recipients.ts` | Modify | Grouped normalize on load, CSC no-duplicates validation |
| `apps/remix/app/components/general/envelope-editor/recipient-row.tsx` | Create | Single recipient row (moved from form) |
| `apps/remix/app/components/general/envelope-editor/recipient-step-card.tsx` | Create | Step card chrome, inner droppable, group header |
| `apps/remix/app/components/general/envelope-editor/recipient-step-list.tsx` | Create | DnD orchestration, gap zones, all mutation handlers |
| `apps/remix/app/components/general/envelope-editor/envelope-editor-recipient-form.tsx` | Modify | Slim down to header/checkboxes/sync + `<RecipientStepList />` |
| `packages/app-tests/e2e/envelope-editor-v2/envelope-recipient-groups.spec.ts` | Create | Editor E2E (type-to-join, ungroup, persistence) |
| `packages/app-tests/e2e/recipient/signing-groups.spec.ts` | Create | Signing-flow E2E (any-order group, gating) |

Execution note: create an isolated worktree first (superpowers:using-git-worktrees). Tasks 1–4 are pure lib (TDD with vitest). Tasks 5–11 are backend/lib wiring (verified by tsc + existing tests + E2E later). Tasks 12–15 are UI. Tasks 16–17 are E2E. Task 18 is final verification.

---

### Task 1: Group derivation + grouped normalization

**Files:**
- Create: `packages/lib/utils/recipient-groups.ts`
- Create: `packages/lib/utils/recipient-groups.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/lib/utils/recipient-groups.test.ts`:

```ts
import { RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { groupRecipientsBySigningOrder, normalizeGroupedSigningOrders } from './recipient-groups';

describe('groupRecipientsBySigningOrder', () => {
  it('groups non-CC recipients sharing a signing order into steps', () => {
    const recipients = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'c', role: RecipientRole.APPROVER, signingOrder: 2 },
      { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    const { steps, ccRecipients } = groupRecipientsBySigningOrder(recipients);

    expect(ccRecipients).toEqual([]);
    expect(steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(steps.map((step) => step.members.map((m) => m.formId))).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('excludes CC recipients from steps', () => {
    const recipients = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.CC, signingOrder: undefined },
    ];

    const { steps, ccRecipients } = groupRecipientsBySigningOrder(recipients);

    expect(steps).toHaveLength(1);
    expect(ccRecipients.map((r) => r.formId)).toEqual(['b']);
  });

  it('sorts steps by order regardless of input order and keeps member input order', () => {
    const recipients = [
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
    ];

    const { steps } = groupRecipientsBySigningOrder(recipients);

    expect(steps.map((step) => step.members.map((m) => m.formId))).toEqual([['a'], ['c', 'b']]);
  });

  it('collects recipients without a signing order into a single tail step', () => {
    const recipients = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: null },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: undefined },
    ];

    const { steps } = groupRecipientsBySigningOrder(recipients);

    expect(steps).toHaveLength(2);
    expect(steps[1].members.map((m) => m.formId)).toEqual(['b', 'c']);
  });
});

describe('normalizeGroupedSigningOrders', () => {
  it('preserves groups while compacting gaps to dense step numbers', () => {
    const recipients = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 5 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 5 },
      { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 9 },
    ];

    expect(normalizeGroupedSigningOrders(recipients).map((r) => r.signingOrder)).toEqual([1, 2, 2, 3]);
  });

  it('moves CC recipients to the tail with an undefined signing order', () => {
    const recipients = [
      { formId: 'cc', role: RecipientRole.CC, signingOrder: 1 },
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 3 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    const normalized = normalizeGroupedSigningOrders(recipients);

    expect(normalized.map((r) => r.formId)).toEqual(['a', 'b', 'cc']);
    expect(normalized.map((r) => r.signingOrder)).toEqual([1, 1, undefined]);
  });

  it('anchors steps containing locked recipients to their persisted order', () => {
    const recipients = [
      { formId: 'locked', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 4 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 4 },
    ];

    const normalized = normalizeGroupedSigningOrders(recipients, (r) => r.formId !== 'locked');

    expect(normalized.map((r) => [r.formId, r.signingOrder])).toEqual([
      ['locked', 1],
      ['a', 2],
      ['b', 2],
    ]);
  });

  it('never renumbers an editable step onto a locked step number', () => {
    const recipients = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'locked', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 5 },
    ];

    const normalized = normalizeGroupedSigningOrders(recipients, (r) => r.formId !== 'locked');

    // 'b' must skip the reserved locked number 2 and take 3, not collide into 2.
    expect(normalized.map((r) => [r.formId, r.signingOrder])).toEqual([
      ['a', 1],
      ['locked', 2],
      ['b', 3],
    ]);
  });

  it('keeps a group intact when it contains the locked recipient', () => {
    const recipients = [
      { formId: 'locked', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'peer', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 7 },
    ];

    const normalized = normalizeGroupedSigningOrders(recipients, (r) => r.formId !== 'locked');

    expect(normalized.map((r) => [r.formId, r.signingOrder])).toEqual([
      ['locked', 2],
      ['peer', 2],
      ['a', 3],
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @documenso/lib -- utils/recipient-groups.test.ts`
Expected: FAIL — cannot resolve `./recipient-groups`.

- [ ] **Step 3: Write the implementation**

Create `packages/lib/utils/recipient-groups.ts`:

```ts
import type { Recipient } from '@prisma/client';

import { isCcRecipient } from './recipients';

/**
 * A recipient "step" is the set of non-CC recipients sharing a signing order.
 * A step with 2 or more members is a "signing group": members may act in any
 * order among themselves, and the next step only unlocks once every member of
 * the group has completed their action.
 */

type GroupableRecipient = Pick<Recipient, 'role'> & {
  signingOrder?: number | null;
};

export type RecipientStep<T> = {
  /**
   * The signing order shared by all members of the step.
   */
  order: number;
  members: T[];
};

const UNORDERED = Number.MAX_SAFE_INTEGER;

const effectiveOrder = (recipient: { signingOrder?: number | null }) => recipient.signingOrder ?? UNORDERED;

/**
 * Derives the ordered list of steps from a list of recipients.
 *
 * - Non-CC recipients sharing a signing order form one step.
 * - Recipients without a signing order share a single tail step.
 * - CC recipients are returned separately and never belong to a step.
 */
export const groupRecipientsBySigningOrder = <T extends GroupableRecipient>(recipients: T[]) => {
  const ccRecipients = recipients.filter((recipient) => isCcRecipient(recipient));
  const nonCcRecipients = recipients.filter((recipient) => !isCcRecipient(recipient));

  const membersByOrder = new Map<number, T[]>();

  for (const recipient of nonCcRecipients) {
    const order = effectiveOrder(recipient);
    const members = membersByOrder.get(order) ?? [];

    members.push(recipient);
    membersByOrder.set(order, members);
  }

  const steps: RecipientStep<T>[] = [...membersByOrder.entries()]
    .sort(([orderA], [orderB]) => orderA - orderB)
    .map(([order, members]) => ({ order, members }));

  return { steps, ccRecipients };
};

/**
 * Dense-renumbers steps to 1..K while preserving groups (duplicate orders).
 *
 * Steps containing a locked recipient (per `canUpdateRecipient`) keep the
 * locked recipient's persisted order, and editable steps never collide into a
 * locked step's number.
 *
 * CC recipients get an undefined signing order and move to the tail. The
 * returned array is re-ordered by step sequence.
 */
export const normalizeGroupedSigningOrders = <T extends GroupableRecipient>(
  recipients: T[],
  canUpdateRecipient: (recipient: T) => boolean = () => true,
): Array<T & { signingOrder?: number }> => {
  const { steps, ccRecipients } = groupRecipientsBySigningOrder(recipients);

  const lockedOrderByStepIndex = new Map<number, number>();

  steps.forEach((step, index) => {
    const lockedMember = step.members.find((member) => !canUpdateRecipient(member));

    if (lockedMember && typeof lockedMember.signingOrder === 'number') {
      lockedOrderByStepIndex.set(index, lockedMember.signingOrder);
    }
  });

  const reservedOrders = new Set(lockedOrderByStepIndex.values());
  const normalizedSteps: RecipientStep<T>[] = [];

  let nextOrder = 1;

  steps.forEach((step, index) => {
    const lockedOrder = lockedOrderByStepIndex.get(index);

    if (lockedOrder !== undefined) {
      normalizedSteps.push({ order: lockedOrder, members: step.members });
      nextOrder = Math.max(nextOrder, lockedOrder + 1);

      return;
    }

    while (reservedOrders.has(nextOrder)) {
      nextOrder += 1;
    }

    normalizedSteps.push({ order: nextOrder, members: step.members });
    nextOrder += 1;
  });

  return [
    ...normalizedSteps.flatMap((step) => step.members.map((member) => ({ ...member, signingOrder: step.order }))),
    ...ccRecipients.map((recipient) => ({ ...recipient, signingOrder: undefined })),
  ];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w @documenso/lib -- utils/recipient-groups.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/lib/utils/recipient-groups.ts packages/lib/utils/recipient-groups.test.ts
git commit -m "feat: add recipient signing group derivation and normalization"
```

---

### Task 2: Editor step operations

**Files:**
- Modify: `packages/lib/utils/recipient-groups.ts` (append)
- Modify: `packages/lib/utils/recipient-groups.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `packages/lib/utils/recipient-groups.test.ts` (add `mergeSteps`, `moveRecipientToStep`, `extractRecipientToNewStep`, `reorderStep`, `ungroupStep` to the existing import from `./recipient-groups`):

```ts
const makeSigners = () => [
  { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
  { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
  { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 3 },
  { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 4 },
];

const ordersOf = (signers: Array<{ formId: string; signingOrder?: number }>) =>
  signers.map((signer) => [signer.formId, signer.signingOrder]);

describe('mergeSteps', () => {
  it('merges all members of the source step into the target step', () => {
    const merged = mergeSteps(makeSigners(), 2, 1);

    expect(ordersOf(merged)).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 3],
    ]);
  });

  it('merges a whole group into another step', () => {
    const signers = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    const merged = mergeSteps(signers, 1, 2);

    expect(ordersOf(merged)).toEqual([
      ['a', 1],
      ['d', 2],
      ['b', 2],
      ['c', 2],
    ]);
  });

  it('returns the input unchanged for an invalid step index', () => {
    const signers = makeSigners();

    expect(mergeSteps(signers, 7, 1)).toEqual(signers);
  });
});

describe('moveRecipientToStep', () => {
  it('appends the recipient to the target step members', () => {
    const moved = moveRecipientToStep(makeSigners(), 'a', 2);

    expect(ordersOf(moved)).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 2],
      ['d', 3],
    ]);
  });

  it('dissolves a group of two when one member joins another step', () => {
    const signers = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
    ];

    const moved = moveRecipientToStep(signers, 'b', 1);

    expect(ordersOf(moved)).toEqual([
      ['a', 1],
      ['c', 2],
      ['b', 2],
    ]);
  });

  it('is a no-op when the recipient is already a member of the target step', () => {
    const signers = makeSigners();

    expect(ordersOf(moveRecipientToStep(signers, 'b', 1))).toEqual(ordersOf(signers));
  });
});

describe('extractRecipientToNewStep', () => {
  it('extracts a group member into its own step at the given gap', () => {
    const signers = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    // Gap index 3 = before step index 3 does not exist here (only 3 steps), so
    // use gap 2 = before the step containing 'd'.
    const extracted = extractRecipientToNewStep(signers, 'c', 2);

    expect(ordersOf(extracted)).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('extracts to the end for an out-of-bounds gap index', () => {
    const signers = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
    ];

    const extracted = extractRecipientToNewStep(signers, 'a', 99);

    expect(ordersOf(extracted)).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('is a no-op when a solo recipient is dropped into an adjacent gap', () => {
    const signers = makeSigners();

    expect(ordersOf(extractRecipientToNewStep(signers, 'b', 1))).toEqual(ordersOf(signers));
    expect(ordersOf(extractRecipientToNewStep(signers, 'b', 2))).toEqual(ordersOf(signers));
  });
});

describe('reorderStep', () => {
  it('moves a whole group to a new position', () => {
    const signers = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    const reordered = reorderStep(signers, 1, 2);

    expect(ordersOf(reordered)).toEqual([
      ['a', 1],
      ['d', 2],
      ['b', 3],
      ['c', 3],
    ]);
  });

  it('keeps a locked step number anchored while others flow around it', () => {
    const signers = [
      { formId: 'locked', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    const reordered = reorderStep(signers, 1, 2, (r) => r.formId !== 'locked');

    expect(ordersOf(reordered)).toEqual([
      ['locked', 1],
      ['c', 2],
      ['b', 3],
    ]);
  });
});

describe('ungroupStep', () => {
  it('splits a group into consecutive standalone steps preserving relative order', () => {
    const signers = [
      { formId: 'a', role: RecipientRole.SIGNER, signingOrder: 1 },
      { formId: 'b', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'c', role: RecipientRole.SIGNER, signingOrder: 2 },
      { formId: 'd', role: RecipientRole.SIGNER, signingOrder: 3 },
    ];

    const ungrouped = ungroupStep(signers, 1);

    expect(ordersOf(ungrouped)).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('is a no-op on a step with a single member', () => {
    const signers = makeSigners();

    expect(ordersOf(ungroupStep(signers, 0))).toEqual(ordersOf(signers));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @documenso/lib -- utils/recipient-groups.test.ts`
Expected: FAIL — `mergeSteps` (etc.) not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/lib/utils/recipient-groups.ts`:

```ts
type EditorRecipient = GroupableRecipient & { formId: string };

/**
 * Merges all members of the source step into the target step.
 */
export const mergeSteps = <T extends EditorRecipient>(
  recipients: T[],
  sourceStepIndex: number,
  targetStepIndex: number,
  canUpdateRecipient?: (recipient: T) => boolean,
): Array<T & { signingOrder?: number }> => {
  const { steps } = groupRecipientsBySigningOrder(recipients);

  const sourceStep = steps[sourceStepIndex];
  const targetStep = steps[targetStepIndex];

  if (!sourceStep || !targetStep || sourceStepIndex === targetStepIndex) {
    return recipients;
  }

  const sourceFormIds = new Set(sourceStep.members.map((member) => member.formId));

  const updated = recipients.map((recipient) =>
    sourceFormIds.has(recipient.formId) ? { ...recipient, signingOrder: targetStep.order } : recipient,
  );

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};

/**
 * Moves a single recipient into the target step (joins the group).
 */
export const moveRecipientToStep = <T extends EditorRecipient>(
  recipients: T[],
  formId: string,
  targetStepIndex: number,
  canUpdateRecipient?: (recipient: T) => boolean,
): Array<T & { signingOrder?: number }> => {
  const { steps } = groupRecipientsBySigningOrder(recipients);

  const targetStep = steps[targetStepIndex];
  const mover = recipients.find((recipient) => recipient.formId === formId);

  if (!targetStep || !mover || isCcRecipient(mover)) {
    return recipients;
  }

  if (targetStep.members.some((member) => member.formId === formId)) {
    return recipients;
  }

  const remaining = recipients.filter((recipient) => recipient.formId !== formId);
  const lastMemberFormId = targetStep.members[targetStep.members.length - 1].formId;
  const insertAfterIndex = remaining.findIndex((recipient) => recipient.formId === lastMemberFormId);

  const updated = [
    ...remaining.slice(0, insertAfterIndex + 1),
    { ...mover, signingOrder: targetStep.order },
    ...remaining.slice(insertAfterIndex + 1),
  ];

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};

/**
 * Extracts a recipient into its own standalone step at the given gap position
 * (gap N sits before step N; an out-of-bounds gap appends to the end).
 */
export const extractRecipientToNewStep = <T extends EditorRecipient>(
  recipients: T[],
  formId: string,
  insertStepIndex: number,
  canUpdateRecipient?: (recipient: T) => boolean,
): Array<T & { signingOrder?: number }> => {
  const { steps } = groupRecipientsBySigningOrder(recipients);

  const mover = recipients.find((recipient) => recipient.formId === formId);

  if (!mover || isCcRecipient(mover)) {
    return recipients;
  }

  const currentStepIndex = steps.findIndex((step) => step.members.some((member) => member.formId === formId));
  const isSoloStep = currentStepIndex !== -1 && steps[currentStepIndex].members.length === 1;

  // Dropping a solo step into the gap directly above or below itself is a no-op.
  if (isSoloStep && (insertStepIndex === currentStepIndex || insertStepIndex === currentStepIndex + 1)) {
    return recipients;
  }

  const insertOrder =
    insertStepIndex >= steps.length
      ? (steps[steps.length - 1]?.order ?? 0) + 1
      : steps[insertStepIndex].order - 0.5;

  const updated = recipients.map((recipient) =>
    recipient.formId === formId ? { ...recipient, signingOrder: insertOrder } : recipient,
  );

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};

/**
 * Moves a whole step (group) to a new position in the step sequence.
 *
 * Locked steps keep their members' persisted orders untouched (the sequence
 * flows around them), and editable steps never collide onto a locked anchor —
 * that would accidentally merge them during re-derivation.
 */
export const reorderStep = <T extends EditorRecipient>(
  recipients: T[],
  fromStepIndex: number,
  toStepIndex: number,
  canUpdateRecipient: (recipient: T) => boolean = () => true,
): Array<T & { signingOrder?: number }> => {
  const { steps, ccRecipients } = groupRecipientsBySigningOrder(recipients);

  if (!steps[fromStepIndex] || fromStepIndex === toStepIndex) {
    return recipients;
  }

  const reorderedSteps = [...steps];
  const [movedStep] = reorderedSteps.splice(fromStepIndex, 1);

  reorderedSteps.splice(Math.min(toStepIndex, reorderedSteps.length), 0, movedStep);

  const isStepLocked = (step: RecipientStep<T>) => step.members.some((member) => !canUpdateRecipient(member));

  const lockedAnchors = new Set(reorderedSteps.filter((step) => isStepLocked(step)).map((step) => step.order));

  const updated = [
    ...reorderedSteps.flatMap((step, index) => {
      if (isStepLocked(step)) {
        return step.members;
      }

      const tempOrder = lockedAnchors.has(index + 1) ? index + 1.5 : index + 1;

      return step.members.map((member) => ({ ...member, signingOrder: tempOrder }));
    }),
    ...ccRecipients,
  ];

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};

/**
 * Dissolves a group into consecutive standalone steps preserving relative order.
 */
export const ungroupStep = <T extends EditorRecipient>(
  recipients: T[],
  stepIndex: number,
  canUpdateRecipient?: (recipient: T) => boolean,
): Array<T & { signingOrder?: number }> => {
  const { steps } = groupRecipientsBySigningOrder(recipients);

  const step = steps[stepIndex];

  if (!step || step.members.length < 2) {
    return recipients;
  }

  const offsetByFormId = new Map(step.members.map((member, index) => [member.formId, index]));

  const updated = recipients.map((recipient) => {
    const offset = offsetByFormId.get(recipient.formId);

    if (offset === undefined) {
      return recipient;
    }

    return { ...recipient, signingOrder: step.order + offset / (step.members.length + 1) };
  });

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w @documenso/lib -- utils/recipient-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/utils/recipient-groups.ts packages/lib/utils/recipient-groups.test.ts
git commit -m "feat: add signing group editor operations"
```

---

### Task 3: Turn predicate, first-group filter, dictation helper

**Files:**
- Modify: `packages/lib/utils/recipient-groups.ts` (append)
- Modify: `packages/lib/utils/recipient-groups.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `packages/lib/utils/recipient-groups.test.ts` (extend the `./recipient-groups` import with `filterRecipientsInFirstSigningGroup`, `getDictatableNextRecipient`, `isRecipientTurnBySigningOrder`; extend the `@prisma/client` import with `SigningStatus`):

```ts
describe('isRecipientTurnBySigningOrder', () => {
  const recipient = (
    id: number,
    signingOrder: number | null,
    signingStatus: SigningStatus,
    role: RecipientRole = RecipientRole.SIGNER,
  ) => ({ id, signingOrder, signingStatus, role });

  it('allows both members of the active group regardless of member order', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.SIGNED),
      recipient(2, 2, SigningStatus.NOT_SIGNED),
      recipient(3, 2, SigningStatus.NOT_SIGNED),
      recipient(4, 3, SigningStatus.NOT_SIGNED),
    ];

    expect(isRecipientTurnBySigningOrder(recipients, recipients[1])).toBe(true);
    expect(isRecipientTurnBySigningOrder(recipients, recipients[2])).toBe(true);
    expect(isRecipientTurnBySigningOrder(recipients, recipients[3])).toBe(false);
  });

  it('blocks later steps until every group member has signed', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.SIGNED),
      recipient(2, 2, SigningStatus.SIGNED),
      recipient(3, 2, SigningStatus.NOT_SIGNED),
      recipient(4, 3, SigningStatus.NOT_SIGNED),
    ];

    expect(isRecipientTurnBySigningOrder(recipients, recipients[3])).toBe(false);
  });

  it('treats a rejected recipient in an earlier step as blocking', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.REJECTED),
      recipient(2, 2, SigningStatus.NOT_SIGNED),
    ];

    expect(isRecipientTurnBySigningOrder(recipients, recipients[1])).toBe(false);
  });

  it('ignores CC recipients entirely', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.NOT_SIGNED, RecipientRole.CC),
      recipient(2, 2, SigningStatus.NOT_SIGNED),
    ];

    expect(isRecipientTurnBySigningOrder(recipients, recipients[1])).toBe(true);
  });

  it('treats recipients without a signing order as a parallel tail group', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.SIGNED),
      recipient(2, null, SigningStatus.NOT_SIGNED),
      recipient(3, null, SigningStatus.NOT_SIGNED),
    ];

    expect(isRecipientTurnBySigningOrder(recipients, recipients[1])).toBe(true);
    expect(isRecipientTurnBySigningOrder(recipients, recipients[2])).toBe(true);
  });
});

describe('filterRecipientsInFirstSigningGroup', () => {
  it('returns every pending recipient sharing the lowest order', () => {
    const pending = [
      { id: 3, signingOrder: 2 },
      { id: 4, signingOrder: 2 },
      { id: 5, signingOrder: 3 },
    ];

    expect(filterRecipientsInFirstSigningGroup(pending).map((r) => r.id)).toEqual([3, 4]);
  });

  it('returns an empty array for no pending recipients', () => {
    expect(filterRecipientsInFirstSigningGroup([])).toEqual([]);
  });
});

describe('getDictatableNextRecipient', () => {
  const recipient = (
    id: number,
    signingOrder: number | null,
    signingStatus: SigningStatus,
    role: RecipientRole = RecipientRole.SIGNER,
  ) => ({ id, signingOrder, signingStatus, role });

  it('returns the next recipient when current is last of their step and next step is a single recipient', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.SIGNED),
      recipient(2, 2, SigningStatus.NOT_SIGNED),
      recipient(3, 3, SigningStatus.NOT_SIGNED),
    ];

    expect(getDictatableNextRecipient({ recipients, currentRecipientId: 2 })?.id).toBe(3);
  });

  it('returns null while a group peer is still unsigned', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.NOT_SIGNED),
      recipient(2, 1, SigningStatus.NOT_SIGNED),
      recipient(3, 2, SigningStatus.NOT_SIGNED),
    ];

    expect(getDictatableNextRecipient({ recipients, currentRecipientId: 1 })).toBeNull();
  });

  it('returns the next single recipient once all group peers signed', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.SIGNED),
      recipient(2, 1, SigningStatus.NOT_SIGNED),
      recipient(3, 2, SigningStatus.NOT_SIGNED),
    ];

    expect(getDictatableNextRecipient({ recipients, currentRecipientId: 2 })?.id).toBe(3);
  });

  it('returns null when the next step is a group', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.NOT_SIGNED),
      recipient(2, 2, SigningStatus.NOT_SIGNED),
      recipient(3, 2, SigningStatus.NOT_SIGNED),
    ];

    expect(getDictatableNextRecipient({ recipients, currentRecipientId: 1 })).toBeNull();
  });

  it('returns null when there is no later step, for CC targets, or unknown recipients', () => {
    const recipients = [
      recipient(1, 1, SigningStatus.NOT_SIGNED),
      recipient(2, null, SigningStatus.NOT_SIGNED, RecipientRole.CC),
    ];

    expect(getDictatableNextRecipient({ recipients, currentRecipientId: 1 })).toBeNull();
    expect(getDictatableNextRecipient({ recipients, currentRecipientId: 999 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @documenso/lib -- utils/recipient-groups.test.ts`
Expected: FAIL — missing exports.

- [ ] **Step 3: Write the implementation**

Append to `packages/lib/utils/recipient-groups.ts` (add `SigningStatus` to a new value import: `import { SigningStatus } from '@prisma/client';` at the top, keeping the existing type import):

```ts
type SignableRecipient = Pick<Recipient, 'role' | 'signingStatus'> & {
  signingOrder?: number | null;
};

/**
 * Whether it is the recipient's turn to act under SEQUENTIAL signing.
 *
 * A recipient may act iff no non-CC recipient with a strictly lower signing
 * order is still unsigned (rejected counts as unsigned/blocking). Recipients
 * sharing a signing order never block each other.
 *
 * Callers are responsible for checking the document is in SEQUENTIAL mode.
 */
export const isRecipientTurnBySigningOrder = <T extends SignableRecipient>(
  recipients: T[],
  currentRecipient: { signingOrder?: number | null },
): boolean => {
  const currentOrder = effectiveOrder(currentRecipient);

  return !recipients.some(
    (recipient) =>
      !isCcRecipient(recipient) &&
      recipient.signingStatus !== SigningStatus.SIGNED &&
      effectiveOrder(recipient) < currentOrder,
  );
};

/**
 * Returns every pending recipient sharing the lowest pending signing order —
 * the "active group". Callers pass an already-filtered pending list.
 */
export const filterRecipientsInFirstSigningGroup = <T extends { signingOrder?: number | null }>(
  pendingRecipients: T[],
): T[] => {
  if (pendingRecipients.length === 0) {
    return [];
  }

  const minOrder = Math.min(...pendingRecipients.map((recipient) => effectiveOrder(recipient)));

  return pendingRecipients.filter((recipient) => effectiveOrder(recipient) === minOrder);
};

/**
 * The single recipient that the current recipient may dictate (rename) on
 * completion, or null when dictation does not apply:
 *
 * - the current recipient must be the last unsigned member of their step, and
 * - the next step must contain exactly one recipient.
 */
export const getDictatableNextRecipient = <T extends SignableRecipient & Pick<Recipient, 'id'>>({
  recipients,
  currentRecipientId,
}: {
  recipients: T[];
  currentRecipientId: number;
}): T | null => {
  const currentRecipient = recipients.find((recipient) => recipient.id === currentRecipientId);

  if (!currentRecipient || isCcRecipient(currentRecipient)) {
    return null;
  }

  const currentOrder = effectiveOrder(currentRecipient);

  const hasUnsignedPeers = recipients.some(
    (recipient) =>
      recipient.id !== currentRecipientId &&
      !isCcRecipient(recipient) &&
      effectiveOrder(recipient) === currentOrder &&
      recipient.signingStatus !== SigningStatus.SIGNED,
  );

  if (hasUnsignedPeers) {
    return null;
  }

  const laterRecipients = recipients.filter(
    (recipient) => !isCcRecipient(recipient) && effectiveOrder(recipient) > currentOrder,
  );

  const nextStep = filterRecipientsInFirstSigningGroup(laterRecipients);

  if (nextStep.length !== 1) {
    return null;
  }

  return nextStep[0];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w @documenso/lib -- utils/recipient-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/utils/recipient-groups.ts packages/lib/utils/recipient-groups.test.ts
git commit -m "feat: add group-aware turn and dictation helpers"
```

---

### Task 4: Group-aware `isAssistantLastSigner`

**Files:**
- Modify: `packages/lib/utils/recipients.ts:25-30`
- Modify: `packages/lib/utils/recipients.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` in `packages/lib/utils/recipients.test.ts`:

```ts
  it('detects an assistant anywhere in the last signing step (groups)', () => {
    expect(
      isAssistantLastSigner([
        { role: RecipientRole.SIGNER, signingOrder: 1 },
        { role: RecipientRole.ASSISTANT, signingOrder: 2 },
        { role: RecipientRole.SIGNER, signingOrder: 2 },
      ]),
    ).toBe(true);

    expect(
      isAssistantLastSigner([
        { role: RecipientRole.ASSISTANT, signingOrder: 1 },
        { role: RecipientRole.SIGNER, signingOrder: 1 },
        { role: RecipientRole.SIGNER, signingOrder: 2 },
      ]),
    ).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @documenso/lib -- utils/recipients.test.ts`
Expected: FAIL — first assertion returns `false` (current implementation checks the last array element; the assistant with order 2 is not last in the array).

- [ ] **Step 3: Replace the implementation**

In `packages/lib/utils/recipients.ts`, replace the existing `isAssistantLastSigner` (lines 25-30) with:

```ts
/**
 * Whether an assistant sits in the last signing step (nobody after them to assist).
 *
 * Falls back to a positional check when no recipient carries a signing order.
 */
export const isAssistantLastSigner = (
  recipients: Array<Pick<Recipient, 'role'> & { signingOrder?: number | null }>,
) => {
  const nonCcRecipients = recipients.filter((recipient) => !isCcRecipient(recipient));

  if (nonCcRecipients.length === 0) {
    return false;
  }

  const hasAnySigningOrder = nonCcRecipients.some((recipient) => typeof recipient.signingOrder === 'number');

  if (!hasAnySigningOrder) {
    return nonCcRecipients[nonCcRecipients.length - 1]?.role === RecipientRole.ASSISTANT;
  }

  const maxOrder = Math.max(
    ...nonCcRecipients.map((recipient) => recipient.signingOrder ?? Number.MAX_SAFE_INTEGER),
  );

  return nonCcRecipients.some(
    (recipient) =>
      (recipient.signingOrder ?? Number.MAX_SAFE_INTEGER) === maxOrder &&
      recipient.role === RecipientRole.ASSISTANT,
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w @documenso/lib -- utils/recipients.test.ts`
Expected: PASS — both the new test and the two existing positional tests (`checks whether the last non-CC recipient is an assistant`).

- [ ] **Step 5: Commit**

```bash
git add packages/lib/utils/recipients.ts packages/lib/utils/recipients.test.ts
git commit -m "feat: make assistant-last-signer check signing-group aware"
```

---

### Task 5: Server turn checks use the shared predicate

**Files:**
- Modify: `packages/lib/server-only/recipient/get-is-recipient-turn.ts`
- Modify: `packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts:263-279`

- [ ] **Step 1: Rewrite `get-is-recipient-turn.ts`**

Replace the entire file content with:

```ts
import { prisma } from '@documenso/prisma';
import { DocumentSigningOrder, EnvelopeType } from '@prisma/client';

import { isRecipientTurnBySigningOrder } from '../../utils/recipient-groups';

export type GetIsRecipientTurnOptions = {
  token: string;
};

export async function getIsRecipientsTurnToSign({ token }: GetIsRecipientTurnOptions) {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      type: EnvelopeType.DOCUMENT,
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  if (envelope.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
    return true;
  }

  const currentRecipient = envelope.recipients.find((recipient) => recipient.token === token);

  if (!currentRecipient) {
    return false;
  }

  return isRecipientTurnBySigningOrder(envelope.recipients, currentRecipient);
}
```

- [ ] **Step 2: Replace the inline copy in `get-envelope-for-recipient-signing.ts`**

Replace lines 263-279 (the `let isRecipientsTurn = true;` block through the closing brace of the `for` loop's `if`) with:

```ts
  const isRecipientsTurn =
    envelope.documentMeta.signingOrder !== DocumentSigningOrder.SEQUENTIAL ||
    isRecipientTurnBySigningOrder(envelope.recipients, recipient);
```

Add the import:

```ts
import { isRecipientTurnBySigningOrder } from '../../utils/recipient-groups';
```

Also remove the now-unneeded `orderBy: { signingOrder: 'asc' }` on the `recipients` include (lines 197-199) — the predicate is order-independent. Then search the file for `RecipientRole` — if it is no longer referenced after this change, remove it from the `@prisma/client` import (keep `SigningStatus`, still used at lines 296-297).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` (workdir `packages/lib`)
Expected: no errors in the two modified files.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/server-only/recipient/get-is-recipient-turn.ts packages/lib/server-only/envelope/get-envelope-for-recipient-signing.ts
git commit -m "feat: use group-aware turn checks for sequential signing"
```

---

### Task 6: `send-document.ts` notifies the whole first group

**Files:**
- Modify: `packages/lib/server-only/document/send-document.ts:150-157`

- [ ] **Step 1: Replace the single-recipient slice**

Replace:

```ts
  let recipientsToNotify = envelope.recipients;

  if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    // Get the currently active recipient.
    recipientsToNotify = envelope.recipients
      .filter((r) => r.signingStatus === SigningStatus.NOT_SIGNED && r.role !== RecipientRole.CC)
      .slice(0, 1);
  }
```

with:

```ts
  let recipientsToNotify = envelope.recipients;

  if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    // Get the currently active signing group. Recipients sharing the lowest
    // pending signing order act in parallel within their group.
    recipientsToNotify = filterRecipientsInFirstSigningGroup(
      envelope.recipients.filter((r) => r.signingStatus === SigningStatus.NOT_SIGNED && r.role !== RecipientRole.CC),
    );
  }
```

Add the import:

```ts
import { filterRecipientsInFirstSigningGroup } from '../../utils/recipient-groups';
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` (workdir `packages/lib`)
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/lib/server-only/document/send-document.ts
git commit -m "feat: notify all members of the first signing group on send"
```

---

### Task 7: `complete-document-with-token.ts` group advance + dictation gating

**Files:**
- Modify: `packages/lib/server-only/document/complete-document-with-token.ts:368-460`

- [ ] **Step 1: Add `sendStatus` to the pending query select**

In the `pendingRecipients` query (lines 368-388), extend the `select`:

```ts
    select: {
      id: true,
      signingOrder: true,
      name: true,
      email: true,
      role: true,
      sendStatus: true,
    },
```

- [ ] **Step 2: Replace the SEQUENTIAL advance branch**

Replace the block from `if (envelope.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL) {` (line 399) through its closing brace (line 459) with:

```ts
    if (envelope.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL) {
      // The active group: every pending recipient sharing the lowest pending
      // signing order. Members already activated (sendStatus SENT) are group
      // peers who were notified earlier — activating only fresh members means
      // a mid-group completion is a no-op and a step transition activates the
      // whole next group at once.
      const nextGroup = filterRecipientsInFirstSigningGroup(pendingRecipients);
      const recipientsToActivate = nextGroup.filter((r) => r.sendStatus !== SendStatus.SENT);

      // Dictation only applies when advancing to a single-recipient step.
      const canDictateNextSigner =
        Boolean(nextSigner) &&
        Boolean(envelope.documentMeta?.allowDictateNextSigner) &&
        nextGroup.length === 1 &&
        recipientsToActivate.length === 1;

      await prisma.$transaction(async (tx) => {
        if (canDictateNextSigner && nextSigner) {
          const [nextRecipient] = recipientsToActivate;

          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
              envelopeId: envelope.id,
              user: {
                name: recipientName,
                email: recipientEmail,
              },
              requestMetadata,
              data: {
                recipientEmail: nextRecipient.email,
                recipientName: nextRecipient.name,
                recipientId: nextRecipient.id,
                recipientRole: nextRecipient.role,
                changes: [
                  {
                    type: RECIPIENT_DIFF_TYPE.NAME,
                    from: nextRecipient.name,
                    to: nextSigner.name,
                  },
                  {
                    type: RECIPIENT_DIFF_TYPE.EMAIL,
                    from: nextRecipient.email,
                    to: nextSigner.email,
                  },
                ],
              },
            }),
          });
        }

        for (const nextRecipient of recipientsToActivate) {
          await tx.recipient.update({
            where: { id: nextRecipient.id },
            data: {
              sendStatus: SendStatus.SENT,
              sentAt: new Date(),
              ...(canDictateNextSigner && nextSigner
                ? {
                    name: nextSigner.name,
                    email: nextSigner.email,
                  }
                : {}),
            },
          });
        }
      });

      for (const nextRecipient of recipientsToActivate) {
        await jobs.triggerJob({
          name: 'send.signing.requested.email',
          payload: {
            userId: envelope.userId,
            documentId: legacyDocumentId,
            recipientId: nextRecipient.id,
            requestMetadata,
          },
        });
      }
    }
```

Add the import:

```ts
import { filterRecipientsInFirstSigningGroup } from '../../utils/recipient-groups';
```

(`SendStatus` is already imported in this file.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` (workdir `packages/lib`)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/server-only/document/complete-document-with-token.ts
git commit -m "feat: activate whole signing group on sequential advance"
```

---

### Task 8: Direct-template dictation + `getNextPendingRecipient`

**Files:**
- Modify: `packages/lib/server-only/template/create-document-from-direct-template.ts:697`
- Modify: `packages/lib/server-only/recipient/get-next-pending-recipient.ts`

- [ ] **Step 1: Gate direct-template dictation to single-member next steps**

In `create-document-from-direct-template.ts`, replace line 697:

```ts
      const nextRecipient = pendingRecipients[0];
```

with:

```ts
      const nextGroup = filterRecipientsInFirstSigningGroup(pendingRecipients);

      // Dictation only applies when the next step is a single recipient.
      const nextRecipient = nextGroup.length === 1 ? nextGroup[0] : null;
```

Add the import:

```ts
import { filterRecipientsInFirstSigningGroup } from '../../utils/recipient-groups';
```

(The following `if (nextRecipient) { ... }` block stays unchanged.)

- [ ] **Step 2: Rewrite `get-next-pending-recipient.ts`**

Replace the entire file content with:

```ts
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { mapDocumentIdToSecondaryId } from '../../utils/envelope';
import { getDictatableNextRecipient } from '../../utils/recipient-groups';

export const getNextPendingRecipient = async ({
  documentId,
  currentRecipientId,
}: {
  documentId: number;
  currentRecipientId: number;
}) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: {
        type: EnvelopeType.DOCUMENT,
        secondaryId: mapDocumentIdToSecondaryId(documentId),
      },
    },
  });

  const nextRecipient = getDictatableNextRecipient({ recipients, currentRecipientId });

  if (!nextRecipient) {
    return null;
  }

  return {
    ...nextRecipient,
    token: '',
  };
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` (workdir `packages/lib`)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/server-only/template/create-document-from-direct-template.ts packages/lib/server-only/recipient/get-next-pending-recipient.ts
git commit -m "feat: gate next-signer dictation to single-recipient steps"
```

---

### Task 9: Assistant scope becomes strictly-greater (self preserved)

**Files:**
- Modify: `packages/lib/server-only/recipient/get-recipients-for-assistant.ts:23-29`
- Modify: `packages/trpc/server/envelope-router/sign-envelope-field.ts:42-51`

Grouped assistants must not act for their group peers (equal order). The current `gte` queries also match the assistant themself — that self-inclusion is load-bearing (assistants insert their own fields through these paths) and must be preserved explicitly.

- [ ] **Step 1: Update `get-recipients-for-assistant.ts`**

Replace the `where` clause of the `recipients` query (lines 24-29):

```ts
    where: {
      envelopeId: assistant.envelopeId,
      OR: [
        // The assistant themself — they may have fields of their own.
        { id: assistant.id },
        // Grouped assistants only assist strictly later steps, never their
        // own group peers.
        { signingOrder: { gt: assistant.signingOrder ?? 0 } },
      ],
    },
```

- [ ] **Step 2: Update the assistant branch in `sign-envelope-field.ts`**

Replace the assistant branch of the `field.recipient` condition (lines 42-51):

```ts
          ...(recipient.role === RecipientRole.ASSISTANT
            ? {
                signingStatus: {
                  not: SigningStatus.SIGNED,
                },
                envelopeId: recipient.envelopeId,
                OR: [
                  // The assistant's own fields.
                  { id: recipient.id },
                  // Fields of recipients in strictly later steps only.
                  { signingOrder: { gt: recipient.signingOrder ?? 0 } },
                ],
              }
            : {
                id: recipient.id,
              }),
```

- [ ] **Step 3: Type-check both packages**

Run: `npx tsc --noEmit` (workdir `packages/lib`), then `npx tsc --noEmit` (workdir `packages/trpc`)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/lib/server-only/recipient/get-recipients-for-assistant.ts packages/trpc/server/envelope-router/sign-envelope-field.ts
git commit -m "feat: scope assistants to strictly later signing steps"
```

---

### Task 10: Client dictation mirrors use `getDictatableNextRecipient`

**Files:**
- Modify: `apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx:292-319`
- Modify: `apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx:145-171`
- Modify: `apps/remix/app/components/general/direct-template/direct-template-signing-form.tsx:217-247`

All three files contain a near-identical `nextRecipient` `useMemo` (sort by order nulls-last then id, return `sortedRecipients[currentIndex + 1]`). Replace each body with the shared helper — the dictate form then only renders when the signer is the last unsigned member of their step and the next step has exactly one member.

- [ ] **Step 1: `envelope-signing-provider.tsx`**

Replace the `nextRecipient` `useMemo` (lines 292-319) with:

```ts
  const nextRecipient = useMemo(() => {
    if (envelope.documentMeta.signingOrder !== 'SEQUENTIAL') {
      return null;
    }

    return getDictatableNextRecipient({
      recipients: envelope.recipients,
      currentRecipientId: recipient.id,
    });
  }, [envelope.documentMeta?.signingOrder, envelope.recipients, recipient.id]);
```

Add the import:

```ts
import { getDictatableNextRecipient } from '@documenso/lib/utils/recipient-groups';
```

- [ ] **Step 2: `document-signing-page-view-v1.tsx`**

Replace the `nextRecipient` `useMemo` (lines 145-171) with:

```ts
  const nextRecipient = useMemo(() => {
    if (documentMeta?.signingOrder !== 'SEQUENTIAL') {
      return undefined;
    }

    return getDictatableNextRecipient({ recipients: allRecipients, currentRecipientId: recipient.id }) ?? undefined;
  }, [document.documentMeta?.signingOrder, allRecipients, recipient.id]);
```

Add the same import.

- [ ] **Step 3: `direct-template-signing-form.tsx`**

Open the file and locate the `nextRecipient` `useMemo` (lines 217-247). Keep the existing early-return guard exactly as-is (it checks `template.templateMeta?.signingOrder !== 'SEQUENTIAL'` plus direct-recipient conditions at lines 218-225) and replace only the sorting/index logic below it with:

```ts
    return (
      getDictatableNextRecipient({
        recipients: template.recipients,
        currentRecipientId: directRecipient.id,
      }) ?? undefined
    );
```

Keep the dependency array unchanged. Add the same import.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit` (workdir `apps/remix`)
Expected: no new errors in the three modified files. If `getDictatableNextRecipient`'s return type narrows the previous local type, keep the surrounding usages (`nextRecipient.name` / `nextRecipient.email`) working — the helper returns the full recipient object from the input array, so no shape changes.

- [ ] **Step 5: Commit**

```bash
git add apps/remix/app/components/general/document-signing/envelope-signing-provider.tsx apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx apps/remix/app/components/general/direct-template/direct-template-signing-form.tsx
git commit -m "feat: gate dictation UI to single-recipient next steps"
```

---

### Task 11: Editor lib support — grouped load, CSC validation, modifiability util

**Files:**
- Modify: `packages/lib/client-only/hooks/use-editor-recipients.ts`
- Modify: `packages/lib/utils/recipients.ts` (append)

- [ ] **Step 1: Load recipients with grouped normalization**

In `use-editor-recipients.ts` line 104, the flat normalizer destroys persisted groups on load. Replace:

```ts
        ? normalizeRecipientSigningOrders(sortRecipientsForSigningOrder(formRecipients))
```

with:

```ts
        ? normalizeGroupedSigningOrders(sortRecipientsForSigningOrder(formRecipients))
```

Update the import at line 12: replace `normalizeRecipientSigningOrders` with `normalizeGroupedSigningOrders` from `../../utils/recipient-groups` (keep `isCcRecipient` and `sortRecipientsForSigningOrder` from `../../utils/recipients`):

```ts
import { normalizeGroupedSigningOrders } from '../../utils/recipient-groups';
import { isCcRecipient, sortRecipientsForSigningOrder } from '../../utils/recipients';
```

- [ ] **Step 2: Add the CSC no-duplicates rule**

In the `superRefine` of `ZEditorRecipientsFormSchema` (after the existing assistant-role loop, before the closing `});`), append:

```ts
    const seenSigningOrders = new Set<number>();

    data.signers.forEach((signer, index) => {
      if (signer.role === RecipientRole.CC || typeof signer.signingOrder !== 'number') {
        return;
      }

      if (seenSigningOrders.has(signer.signingOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CSC envelopes do not support recipient signing groups.',
          path: ['signers', index, 'signingOrder'],
        });
      }

      seenSigningOrders.add(signer.signingOrder);
    });
```

- [ ] **Step 3: Add `canEditorRecipientBeModified` to `recipients.ts`**

Append to `packages/lib/utils/recipients.ts` (add `EnvelopeType` to the `@prisma/client` value import and add `import type { TEditorEnvelope } from '../types/envelope-editor';`):

```ts
/**
 * Editor-level wrapper around `canRecipientBeModified`.
 *
 * Template recipients and unsaved (id-less) recipients can always be modified.
 */
export const canEditorRecipientBeModified = (
  envelope: Pick<TEditorEnvelope, 'type' | 'recipients' | 'fields'>,
  recipientId?: number,
) => {
  if (envelope.type === EnvelopeType.TEMPLATE) {
    return true;
  }

  if (recipientId === undefined) {
    return true;
  }

  const recipient = envelope.recipients.find((r) => r.id === recipientId);

  if (!recipient) {
    return false;
  }

  return canRecipientBeModified(recipient, envelope.fields);
};
```

- [ ] **Step 4: Type-check and run lib tests**

Run: `npx tsc --noEmit` (workdir `packages/lib`), then `npm run test -w @documenso/lib`
Expected: no errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/client-only/hooks/use-editor-recipients.ts packages/lib/utils/recipients.ts
git commit -m "feat: load editor recipients with group-preserving normalization"
```

---

### Task 12: `RecipientRow` component

**Files:**
- Create: `apps/remix/app/components/general/envelope-editor/recipient-row.tsx`

This is the row markup extracted from `envelope-editor-recipient-form.tsx:845-1065`, parameterized. No tests of its own (covered by E2E + tsc); the form keeps compiling because it is not rewired until Task 15.

- [ ] **Step 1: Create the component**

```tsx
import type { TEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { isCcRecipient } from '@documenso/lib/utils/recipients';
import { RecipientActionAuthSelect } from '@documenso/ui/components/recipient/recipient-action-auth-select';
import {
  RecipientAutoCompleteInput,
  type RecipientAutoCompleteOption,
} from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useLingui } from '@lingui/react/macro';
import { EnvelopeType, type RecipientRole } from '@prisma/client';
import { GripVerticalIcon, TrashIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

type TEditorSigner = TEditorRecipientsFormSchema['signers'][number];

export type RecipientRowProps = {
  signerIndex: number;
  signer: TEditorSigner;
  stepCount: number;
  isSequential: boolean;
  isGrouped: boolean;
  isInputDisabled: boolean;
  canBeModified: boolean;
  isRemoveDisabled: boolean;
  showAdvancedSettings: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  recipientSuggestions: RecipientAutoCompleteOption[];
  isLoadingSuggestions: boolean;
  onSigningOrderChange: (signerIndex: number, value: string) => void;
  onRoleChange: (signerIndex: number, role: RecipientRole) => void;
  onRemove: (signerIndex: number) => void;
  onAutoCompleteSelect: (signerIndex: number, suggestion: RecipientAutoCompleteOption) => void;
  onSearchQueryChange: (query: string) => void;
};

export const RecipientRow = ({
  signerIndex,
  signer,
  stepCount,
  isSequential,
  isGrouped,
  isInputDisabled,
  canBeModified,
  isRemoveDisabled,
  showAdvancedSettings,
  dragHandleProps,
  recipientSuggestions,
  isLoadingSuggestions,
  onSigningOrderChange,
  onRoleChange,
  onRemove,
  onAutoCompleteSelect,
  onSearchQueryChange,
}: RecipientRowProps) => {
  const { t } = useLingui();

  const { envelope, editorConfig } = useCurrentEnvelopeEditor();
  const organisation = useCurrentOrganisation();

  const form = useFormContext<TEditorRecipientsFormSchema>();

  const { isSubmitting } = form.formState;

  const isDirectRecipient =
    envelope.type === EnvelopeType.TEMPLATE &&
    envelope.directLink !== null &&
    signer.id === envelope.directLink.directTemplateRecipientId;

  const isFieldDisabled = isInputDisabled || isSubmitting || !canBeModified;

  const rowErrors = form.formState.errors.signers?.[signerIndex];

  return (
    <fieldset data-native-id={signer.id} disabled={isSubmitting || !canBeModified} className="py-1">
      <div className="flex flex-row items-center gap-x-2">
        {isSequential && !isCcRecipient(signer) && (
          <FormField
            control={form.control}
            name={`signers.${signerIndex}.signingOrder`}
            render={({ field }) => (
              <FormItem
                className={cn('mt-auto flex items-center gap-x-1 space-y-0', {
                  'mb-6': rowErrors && !rowErrors.signingOrder,
                })}
              >
                <span {...(dragHandleProps ?? {})} data-testid="recipient-row-drag-handle">
                  <GripVerticalIcon
                    className={cn('h-5 w-5 flex-shrink-0 opacity-40', {
                      'opacity-10': !dragHandleProps,
                    })}
                  />
                </span>

                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={stepCount + 1}
                    data-testid="signing-order-input"
                    className={cn(
                      'w-10 text-center',
                      '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      {
                        'border-primary/50 bg-primary/5': isGrouped,
                      },
                    )}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      onSigningOrderChange(signerIndex, e.target.value);
                    }}
                    onBlur={(e) => {
                      field.onBlur();
                      onSigningOrderChange(signerIndex, e.target.value);
                    }}
                    disabled={isFieldDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name={`signers.${signerIndex}.email`}
          render={({ field }) => (
            <FormItem
              className={cn('relative w-full', {
                'mb-6': rowErrors && !rowErrors.email,
              })}
            >
              <FormControl>
                <RecipientAutoCompleteInput
                  type="email"
                  placeholder={t`Email`}
                  value={field.value}
                  disabled={isFieldDisabled || isDirectRecipient}
                  options={recipientSuggestions}
                  onSelect={(suggestion) => onAutoCompleteSelect(signerIndex, suggestion)}
                  onSearchQueryChange={(query) => {
                    field.onChange(query);
                    onSearchQueryChange(query);
                  }}
                  loading={isLoadingSuggestions}
                  data-testid="signer-email-input"
                  maxLength={254}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`signers.${signerIndex}.name`}
          render={({ field }) => (
            <FormItem
              className={cn('w-full', {
                'mb-6': rowErrors && !rowErrors.name,
              })}
            >
              <FormControl>
                <RecipientAutoCompleteInput
                  type="text"
                  placeholder={t`Recipient ${signerIndex + 1}`}
                  {...field}
                  disabled={isFieldDisabled || isDirectRecipient}
                  options={recipientSuggestions}
                  onSelect={(suggestion) => onAutoCompleteSelect(signerIndex, suggestion)}
                  onSearchQueryChange={(query) => {
                    field.onChange(query);
                    onSearchQueryChange(query);
                  }}
                  loading={isLoadingSuggestions}
                  maxLength={255}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`signers.${signerIndex}.role`}
          render={({ field }) => (
            <FormItem
              className={cn('mt-auto w-fit', {
                'mb-6': rowErrors && !rowErrors.role,
              })}
            >
              <FormControl>
                <RecipientRoleSelect
                  {...field}
                  hideAssistantRole={!editorConfig.recipients?.allowAssistantRole}
                  hideCCerRole={!editorConfig.recipients?.allowCCerRole}
                  hideViewerRole={!editorConfig.recipients?.allowViewerRole}
                  hideApproverRole={!editorConfig.recipients?.allowApproverRole}
                  isAssistantEnabled={isSequential}
                  onValueChange={(value) => {
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    onRoleChange(signerIndex, value as RecipientRole);
                  }}
                  disabled={isFieldDisabled}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          variant="ghost"
          className={cn('mt-auto px-2', {
            'mb-6': rowErrors,
          })}
          data-testid="remove-signer-button"
          disabled={isFieldDisabled || isRemoveDisabled || isDirectRecipient}
          onClick={() => onRemove(signerIndex)}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>

      {showAdvancedSettings && organisation.organisationClaim.flags.cfr21 && (
        <FormField
          control={form.control}
          name={`signers.${signerIndex}.actionAuth`}
          render={({ field }) => (
            <FormItem
              className={cn('mt-2 w-full', {
                'mb-6': rowErrors && !rowErrors.actionAuth,
                'pl-6': isSequential,
              })}
            >
              <FormControl>
                <RecipientActionAuthSelect {...field} onValueChange={field.onChange} disabled={isFieldDisabled} />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </fieldset>
  );
};
```

Notes vs the original markup: the `motion.fieldset` becomes a plain `fieldset` (it carried no animation props); the first-row `Email`/`Name` labels move to the list header (Task 14); the CC spacer div is dropped (CC rows render in their own card without an order column).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` (workdir `apps/remix`)
Expected: no errors (component is not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add apps/remix/app/components/general/envelope-editor/recipient-row.tsx
git commit -m "feat: extract envelope editor recipient row component"
```

---

### Task 13: `RecipientStepCard` component

**Files:**
- Create: `apps/remix/app/components/general/envelope-editor/recipient-step-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { TEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import type { RecipientStep } from '@documenso/lib/utils/recipient-groups';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Trans } from '@lingui/react/macro';
import { GripVerticalIcon, Users2Icon } from 'lucide-react';

import { RecipientRow, type RecipientRowProps } from './recipient-row';

type TEditorSigner = TEditorRecipientsFormSchema['signers'][number];

export type DraggingType = 'STEP' | 'RECIPIENT' | null;

export type RecipientStepCardSharedRowProps = Pick<
  RecipientRowProps,
  | 'stepCount'
  | 'showAdvancedSettings'
  | 'recipientSuggestions'
  | 'isLoadingSuggestions'
  | 'onSigningOrderChange'
  | 'onRoleChange'
  | 'onRemove'
  | 'onAutoCompleteSelect'
  | 'onSearchQueryChange'
>;

export type RecipientStepCardProps = {
  stepIndex: number;
  step: RecipientStep<TEditorSigner>;
  draggableProvided: DraggableProvided;
  draggableSnapshot: DraggableStateSnapshot;
  draggingType: DraggingType;
  isStepLocked: boolean;
  isRemoveDisabled: boolean;
  flatIndexByFormId: Map<string, number>;
  canSignerBeModified: (signer: TEditorSigner) => boolean;
  isSubmitting: boolean;
  onUngroup: (stepIndex: number) => void;
  rowProps: RecipientStepCardSharedRowProps;
};

export const RecipientStepCard = ({
  stepIndex,
  step,
  draggableProvided,
  draggableSnapshot,
  draggingType,
  isStepLocked,
  isRemoveDisabled,
  flatIndexByFormId,
  canSignerBeModified,
  isSubmitting,
  onUngroup,
  rowProps,
}: RecipientStepCardProps) => {
  const isGroup = step.members.length > 1;
  const isCombineTarget = draggingType === 'STEP' && Boolean(draggableSnapshot.combineTargetFor);

  return (
    <div
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
      className={cn('py-1', {
        'pointer-events-none': draggableSnapshot.isDragging,
      })}
    >
      <Droppable
        droppableId={`step-members-${stepIndex}`}
        type="RECIPIENT"
        isDropDisabled={draggingType !== 'RECIPIENT'}
      >
        {(droppableProvided, droppableSnapshot) => {
          const isJoinTarget = draggingType === 'RECIPIENT' && droppableSnapshot.isDraggingOver;
          const isHighlighted = isCombineTarget || isJoinTarget;

          return (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              data-testid="recipient-step-card"
              className={cn('relative rounded-lg border px-3 pb-1 pt-2', {
                'border-primary/60 bg-primary/5': isGroup,
                'bg-widget-foreground': draggableSnapshot.isDragging,
                'border-primary ring-1 ring-primary': isHighlighted,
              })}
            >
              {isHighlighted && (
                <Badge
                  variant="default"
                  size="small"
                  className="absolute -top-3 right-4 z-10 flex items-center gap-x-1 shadow-sm"
                >
                  <Users2Icon className="h-3 w-3" />
                  <Trans>Release to sign together</Trans>
                </Badge>
              )}

              <div className="flex flex-row items-center gap-x-2">
                <span
                  {...(draggableProvided.dragHandleProps ?? {})}
                  data-testid="step-drag-handle"
                  className={cn({ 'pointer-events-none opacity-30': isStepLocked })}
                >
                  <GripVerticalIcon className="h-4 w-4 opacity-40" />
                </span>

                <Badge variant="neutral" size="small">
                  <Trans>Step {step.order}</Trans>
                </Badge>

                {isGroup && (
                  <>
                    <span className="flex items-center gap-x-1.5 text-xs text-muted-foreground">
                      <Users2Icon className="h-3.5 w-3.5" />
                      <Trans>{step.members.length} signers · any order</Trans>
                    </span>

                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      data-testid="ungroup-step-button"
                      className="ml-auto h-auto p-0 text-xs"
                      disabled={isStepLocked || isSubmitting}
                      onClick={() => onUngroup(stepIndex)}
                    >
                      <Trans>Ungroup</Trans>
                    </Button>
                  </>
                )}
              </div>

              {step.members.map((member, memberIndex) => {
                const signerIndex = flatIndexByFormId.get(member.formId) ?? -1;
                const canBeModified = canSignerBeModified(member);

                return (
                  <Draggable
                    key={member.formId}
                    draggableId={`recipient-${member.formId}`}
                    index={memberIndex}
                    isDragDisabled={isSubmitting || !canBeModified}
                  >
                    {(memberProvided, memberSnapshot) => (
                      <div
                        ref={memberProvided.innerRef}
                        {...memberProvided.draggableProps}
                        className={cn({
                          'rounded-md bg-widget-foreground': memberSnapshot.isDragging,
                        })}
                      >
                        <RecipientRow
                          signerIndex={signerIndex}
                          signer={member}
                          isSequential={true}
                          isGrouped={isGroup}
                          isInputDisabled={memberSnapshot.isDragging || draggableSnapshot.isDragging}
                          canBeModified={canBeModified}
                          isRemoveDisabled={isRemoveDisabled}
                          dragHandleProps={memberProvided.dragHandleProps}
                          {...rowProps}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}

              {droppableProvided.placeholder}
            </div>
          );
        }}
      </Droppable>
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` (workdir `apps/remix`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/remix/app/components/general/envelope-editor/recipient-step-card.tsx
git commit -m "feat: add envelope editor recipient step card"
```

---

### Task 14: `RecipientStepList` component

**Files:**
- Create: `apps/remix/app/components/general/envelope-editor/recipient-step-list.tsx`

Owns: recipient-suggestion search (moved from the form), all mutation handlers (role change, type-to-join order input, remove, ungroup), the nested DnD wiring, gap zones, the flat parallel-mode list, and CC cards.

- [ ] **Step 1: Create the component**

```tsx
import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import type { TEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  extractRecipientToNewStep,
  groupRecipientsBySigningOrder,
  mergeSteps,
  moveRecipientToStep,
  normalizeGroupedSigningOrders,
  reorderStep,
  ungroupStep,
} from '@documenso/lib/utils/recipient-groups';
import {
  canEditorRecipientBeModified,
  isAssistantLastSigner,
  isCcRecipient,
} from '@documenso/lib/utils/recipients';
import { trpc } from '@documenso/trpc/react';
import type { RecipientAutoCompleteOption } from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { BeforeCapture, DropResult } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { useCallback, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { RecipientRow } from './recipient-row';
import { type DraggingType, RecipientStepCard } from './recipient-step-card';

type TEditorSigner = TEditorRecipientsFormSchema['signers'][number];

const RecipientStepGap = ({ gapIndex, draggingType }: { gapIndex: number; draggingType: DraggingType }) => (
  <Droppable droppableId={`gap-${gapIndex}`} type="RECIPIENT" isDropDisabled={draggingType !== 'RECIPIENT'}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        data-testid="recipient-step-gap"
        className={cn(
          'rounded-md transition-all',
          draggingType === 'RECIPIENT' ? 'my-1 min-h-10 border border-dashed' : 'h-2',
          {
            'border-primary bg-primary/10': snapshot.isDraggingOver,
          },
        )}
      >
        <div className="hidden">{provided.placeholder}</div>
      </div>
    )}
  </Droppable>
);

export type RecipientStepListProps = {
  showAdvancedSettings: boolean;
};

export const RecipientStepList = ({ showAdvancedSettings }: RecipientStepListProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const { envelope, editorRecipients, isEmbedded } = useCurrentEnvelopeEditor();
  const { form } = editorRecipients;

  const [draggingType, setDraggingType] = useState<DraggingType>(null);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  const debouncedRecipientSearchQuery = useDebouncedValue(recipientSearchQuery, 500);

  const { data: recipientSuggestionsData, isLoading } = trpc.recipient.suggestions.find.useQuery(
    {
      query: debouncedRecipientSearchQuery,
    },
    {
      enabled: debouncedRecipientSearchQuery.length > 1 && !isEmbedded,
      retry: false,
    },
  );

  const recipientSuggestions = recipientSuggestionsData?.results || [];

  const watchedSigners = form.watch('signers');
  const isSequential = form.watch('signingOrder') === DocumentSigningOrder.SEQUENTIAL;
  const { isSubmitting } = form.formState;

  const { steps, ccRecipients } = useMemo(() => groupRecipientsBySigningOrder(watchedSigners), [watchedSigners]);

  const stepCount = steps.length;
  const isRemoveDisabled = watchedSigners.length === 1;

  const flatIndexByFormId = useMemo(
    () => new Map(watchedSigners.map((signer, index) => [signer.formId, index])),
    [watchedSigners],
  );

  const canSignerBeModified = useCallback(
    (signer: TEditorSigner) => canEditorRecipientBeModified(envelope, signer.id),
    [envelope],
  );

  const applySigners = useCallback(
    (updatedSigners: TEditorSigner[], options: { warnWhenAssistantLast?: boolean } = {}) => {
      const { warnWhenAssistantLast = true } = options;

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (warnWhenAssistantLast && isAssistantLastSigner(updatedSigners)) {
        toast({
          title: t`Warning: Assistant as last signer`,
          description: t`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
        });
      }

      void form.trigger('signers');
    },
    [form, t, toast],
  );

  const handleSigningOrderChange = useCallback(
    (signerIndex: number, newOrderString: string) => {
      const trimmedOrderString = newOrderString.trim();

      if (!trimmedOrderString) {
        return;
      }

      const newOrder = Number(trimmedOrderString);

      if (!Number.isInteger(newOrder) || newOrder < 1) {
        return;
      }

      const currentSigners = form.getValues('signers');
      const signer = currentSigners[signerIndex];

      if (!signer || isCcRecipient(signer)) {
        return;
      }

      const { steps: currentSteps } = groupRecipientsBySigningOrder(currentSigners);

      const currentStepIndex = currentSteps.findIndex((step) =>
        step.members.some((member) => member.formId === signer.formId),
      );
      const targetStepIndex = newOrder - 1;

      if (targetStepIndex === currentStepIndex) {
        return;
      }

      // Typing an existing step number joins that step's group; an
      // out-of-bounds number extracts the recipient to a standalone step at
      // the end.
      const updatedSigners =
        targetStepIndex >= currentSteps.length
          ? extractRecipientToNewStep(currentSigners, signer.formId, currentSteps.length, canSignerBeModified)
          : moveRecipientToStep(currentSigners, signer.formId, targetStepIndex, canSignerBeModified);

      applySigners(updatedSigners, { warnWhenAssistantLast: signer.role === RecipientRole.ASSISTANT });
    },
    [form, canSignerBeModified, applySigners],
  );

  const handleRoleChange = useCallback(
    (signerIndex: number, role: RecipientRole) => {
      const currentSigners = form.getValues('signers');
      const signingOrder = form.getValues('signingOrder');

      if (role === RecipientRole.ASSISTANT && signingOrder === DocumentSigningOrder.PARALLEL) {
        form.setValue('signingOrder', DocumentSigningOrder.SEQUENTIAL, {
          shouldValidate: true,
          shouldDirty: true,
        });

        toast({
          title: t`Signing order is enabled.`,
          description: t`You cannot add assistants when signing order is disabled.`,
          variant: 'destructive',
        });

        return;
      }

      const updatedSigners = normalizeGroupedSigningOrders(
        currentSigners.map((signer, index) => ({
          ...signer,
          role: index === signerIndex ? role : signer.role,
        })),
        canSignerBeModified,
      );

      applySigners(updatedSigners, { warnWhenAssistantLast: role === RecipientRole.ASSISTANT });
    },
    [form, toast, t, canSignerBeModified, applySigners],
  );

  const handleRemove = useCallback(
    (signerIndex: number) => {
      const signer = form.getValues('signers')[signerIndex];

      if (!signer) {
        return;
      }

      if (!canSignerBeModified(signer)) {
        toast({
          title: t`Cannot remove signer`,
          description: t`This signer has already signed the document.`,
          variant: 'destructive',
        });

        return;
      }

      const updatedSigners = normalizeGroupedSigningOrders(
        form.getValues('signers').filter((s) => s.formId !== signer.formId),
        canSignerBeModified,
      );

      applySigners(updatedSigners, { warnWhenAssistantLast: false });
    },
    [form, toast, t, canSignerBeModified, applySigners],
  );

  const handleUngroup = useCallback(
    (stepIndex: number) => {
      applySigners(ungroupStep(form.getValues('signers'), stepIndex, canSignerBeModified));
    },
    [form, canSignerBeModified, applySigners],
  );

  const handleAutoCompleteSelect = useCallback(
    (signerIndex: number, suggestion: RecipientAutoCompleteOption) => {
      form.setValue(`signers.${signerIndex}.email`, suggestion.email, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue(`signers.${signerIndex}.name`, suggestion.name || '', {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [form],
  );

  const onBeforeCapture = useCallback((before: BeforeCapture) => {
    setDraggingType(before.draggableId.startsWith('step-') ? 'STEP' : 'RECIPIENT');
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDraggingType(null);

      const currentSigners = form.getValues('signers');

      if (result.type === 'STEP') {
        if (result.combine) {
          const targetStepIndex = Number(result.combine.draggableId.slice('step-'.length));

          applySigners(mergeSteps(currentSigners, result.source.index, targetStepIndex, canSignerBeModified));

          return;
        }

        if (result.destination) {
          applySigners(reorderStep(currentSigners, result.source.index, result.destination.index, canSignerBeModified));
        }

        return;
      }

      if (result.type === 'RECIPIENT' && result.destination) {
        const formId = result.draggableId.slice('recipient-'.length);
        const { droppableId } = result.destination;

        if (droppableId.startsWith('gap-')) {
          const gapIndex = Number(droppableId.slice('gap-'.length));

          applySigners(extractRecipientToNewStep(currentSigners, formId, gapIndex, canSignerBeModified));

          return;
        }

        if (droppableId.startsWith('step-members-')) {
          const targetStepIndex = Number(droppableId.slice('step-members-'.length));

          applySigners(moveRecipientToStep(currentSigners, formId, targetStepIndex, canSignerBeModified));
        }
      }
    },
    [form, canSignerBeModified, applySigners],
  );

  const sharedRowProps = {
    stepCount,
    showAdvancedSettings,
    recipientSuggestions,
    isLoadingSuggestions: isLoading,
    onSigningOrderChange: handleSigningOrderChange,
    onRoleChange: handleRoleChange,
    onRemove: handleRemove,
    onAutoCompleteSelect: handleAutoCompleteSelect,
    onSearchQueryChange: setRecipientSearchQuery,
  };

  return (
    <div>
      {!showAdvancedSettings && (
        <div className={cn('mb-1 flex flex-row gap-x-2 text-sm', { 'pl-[4.75rem]': isSequential })}>
          <span className="w-full">
            <Trans>Email</Trans>
          </span>
          <span className="w-full">
            <Trans>Name</Trans>
          </span>
          <span className="w-[7.5rem] flex-shrink-0" />
        </div>
      )}

      {!isSequential ? (
        <div className="flex w-full flex-col">
          {watchedSigners.map((signer, index) => (
            <RecipientRow
              key={signer.formId}
              signerIndex={index}
              signer={signer}
              isSequential={false}
              isGrouped={false}
              isInputDisabled={false}
              canBeModified={canSignerBeModified(signer)}
              isRemoveDisabled={isRemoveDisabled}
              dragHandleProps={null}
              {...sharedRowProps}
            />
          ))}
        </div>
      ) : (
        <>
          <DragDropContext onBeforeCapture={onBeforeCapture} onDragEnd={onDragEnd}>
            <Droppable droppableId="recipient-steps" type="STEP" isCombineEnabled>
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="flex w-full flex-col">
                  {steps.map((step, stepIndex) => {
                    const isStepLocked = step.members.some((member) => !canSignerBeModified(member));

                    return (
                      <div key={`step-fragment-${step.members[0].formId}`}>
                        <RecipientStepGap gapIndex={stepIndex} draggingType={draggingType} />

                        <Draggable
                          draggableId={`step-${stepIndex}`}
                          index={stepIndex}
                          isDragDisabled={isSubmitting || isStepLocked}
                        >
                          {(draggableProvided, draggableSnapshot) => (
                            <RecipientStepCard
                              stepIndex={stepIndex}
                              step={step}
                              draggableProvided={draggableProvided}
                              draggableSnapshot={draggableSnapshot}
                              draggingType={draggingType}
                              isStepLocked={isStepLocked}
                              isRemoveDisabled={isRemoveDisabled}
                              flatIndexByFormId={flatIndexByFormId}
                              canSignerBeModified={canSignerBeModified}
                              isSubmitting={isSubmitting}
                              onUngroup={handleUngroup}
                              rowProps={sharedRowProps}
                            />
                          )}
                        </Draggable>
                      </div>
                    );
                  })}

                  <RecipientStepGap gapIndex={steps.length} draggingType={draggingType} />

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {ccRecipients.map((signer) => (
            <div key={signer.formId} className="my-1 rounded-lg border px-3 py-1">
              <RecipientRow
                signerIndex={flatIndexByFormId.get(signer.formId) ?? -1}
                signer={signer}
                isSequential={true}
                isGrouped={false}
                isInputDisabled={false}
                canBeModified={canSignerBeModified(signer)}
                isRemoveDisabled={isRemoveDisabled}
                dragHandleProps={null}
                {...sharedRowProps}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` (workdir `apps/remix`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/remix/app/components/general/envelope-editor/recipient-step-list.tsx
git commit -m "feat: add envelope editor recipient step list with group drag and drop"
```

---

### Task 15: Rewire `envelope-editor-recipient-form.tsx`

**Files:**
- Modify: `apps/remix/app/components/general/envelope-editor/envelope-editor-recipient-form.tsx`

The form keeps: card header (AI detect / Add Myself / Add Signer), the signing-order + dictate checkboxes, the autosave watch-effect (lines 524-588 — unchanged logic), the recipient-limit alert, `SigningOrderConfirmation`, and the AI dialogs. Everything list-related moves to `RecipientStepList`.

- [ ] **Step 1: Update imports**

Remove these imports (now unused here): `useDebouncedValue`, `normalizeRecipientSigningOrders` and `canRecipientBeModified as utilCanRecipientBeModified` (from `utils/recipients`), `trpc`, `RecipientActionAuthSelect`, `RecipientAutoCompleteInput`/`RecipientAutoCompleteOption`, `RecipientRoleSelect`, `Input`, `FormMessage` (keep `Form`, `FormControl`, `FormField`, `FormItem`, `FormLabel` — all still used by the signing-order/dictate checkboxes), `DragDropContext`/`Draggable`/`Droppable`/`DropResult`/`SensorAPI`, `motion`, `GripVerticalIcon`/`TrashIcon`, `useFieldArray`. Keep `useRef` (still used by `isFirstRender`).

Keep: `isAssistantLastSigner`, `isCcRecipient` (used by `emptySignerIndex`/`activeRecipientCount` replacement below), `plural`, `SendStatus`, etc.

Add:

```ts
import { groupRecipientsBySigningOrder, normalizeGroupedSigningOrders } from '@documenso/lib/utils/recipient-groups';
import { canEditorRecipientBeModified } from '@documenso/lib/utils/recipients';

import { RecipientStepList } from './recipient-step-list';
```

- [ ] **Step 2: Replace helpers**

Delete the `$sensorApi` ref (line 112) and the `useFieldArray` block (lines 169-173).

Replace the `canRecipientBeModified` local function (lines 194-210) with:

```ts
  const canRecipientBeModified = (recipientId?: number) => canEditorRecipientBeModified(envelope, recipientId);
```

Replace `normalizeSigningOrders` (lines 163-165) with:

```ts
  const normalizeSigningOrders = (signers: typeof watchedSigners) => {
    return normalizeGroupedSigningOrders(signers, (signer) => canRecipientBeModified(signer.id));
  };
```

Replace `activeRecipientCount` (line 167) with a step count:

```ts
  const stepCount = useMemo(() => groupRecipientsBySigningOrder(watchedSigners).steps.length, [watchedSigners]);
```

In `onAddSigner` (line 236) and `onAddSelfSigner` (line 351), replace `signingOrder: activeRecipientCount + 1` with `signingOrder: stepCount + 1`.

Delete these now-moved functions entirely: `onDragEnd` (lines 371-405), `handleRoleChange` (lines 407-446), `handleSigningOrderChange` (lines 448-494), `onRemoveSigner` (lines 305-329), `handleRecipientAutoCompleteSelect` (lines 360-369), and the recipient-suggestions state/query (lines 64, 110, 116-126).

Replace all remaining references to the removed `signers` field-array variable with `watchedSigners`:
- `isOverRecipientLimit` (line 591): `watchedSigners.length > recipientCountLimit`
- Add Signer disabled (line 647): `watchedSigners.length >= remaining.recipients`

- [ ] **Step 3: Replace the list markup**

Inside `<Form {...form}>`, replace everything from `<DragDropContext` (line 797) through its closing `</DragDropContext>` (line 1077) with:

```tsx
          <RecipientStepList showAdvancedSettings={showAdvancedSettings} />
```

Keep the `<FormErrorMessage ... signers__root ... />` block after it unchanged.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit` (workdir `apps/remix`), then `npm run lint`
Expected: no errors; lint may flag leftover unused imports — remove any it reports.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev` — open a document editor, verify: sequential off → flat rows; sequential on → step cards with badges; typing a duplicate order groups two recipients (green card, `2 signers · any order`, `Ungroup`); dragging a solo card onto another shows the green ring + "Release to sign together" badge and merges; dragging a member row out to a dashed gap extracts it; Ungroup dissolves; autosave persists (reload keeps the group).

- [ ] **Step 6: Commit**

```bash
git add apps/remix/app/components/general/envelope-editor/envelope-editor-recipient-form.tsx
git commit -m "feat: render envelope editor recipients as signing step cards"
```

---

### Task 16: E2E — editor grouping

**Files:**
- Create: `packages/app-tests/e2e/envelope-editor-v2/envelope-recipient-groups.spec.ts`

Follows the envelope-editor-v2 fixture pattern. Grouping is exercised through the type-to-join path (drag correctness is covered by unit tests; DnD in Playwright is flaky).

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  clickAddSignerButton,
  getSigningOrderInputs,
  openDocumentEnvelopeEditor,
  openTemplateEnvelopeEditor,
  setRecipientEmail,
  setRecipientName,
  setSigningOrderValue,
  toggleSigningOrder,
} from '../fixtures/envelope-editor';

const expectRecipientOrders = async (surface: TEnvelopeEditorSurface, expected: Array<[string, number]>) => {
  await expect
    .poll(
      async () => {
        const recipients = await prisma.recipient.findMany({
          where: { envelopeId: surface.envelopeId },
        });

        return recipients.map((r) => [r.email, r.signingOrder] as const).sort((a, b) => a[0].localeCompare(b[0]));
      },
      { timeout: 15_000 },
    )
    .toEqual([...expected].sort((a, b) => a[0].localeCompare(b[0])));
};

const runGroupingFlow = async (surface: TEnvelopeEditorSurface) => {
  const { root } = surface;

  await setRecipientEmail(root, 0, 'alice@example.com');
  await setRecipientName(root, 0, 'Alice');

  await clickAddSignerButton(root);
  await setRecipientEmail(root, 1, 'bob@example.com');

  await clickAddSignerButton(root);
  await setRecipientEmail(root, 2, 'carol@example.com');

  await toggleSigningOrder(root, true);

  // Three standalone steps.
  await expect(root.getByText('Step 1', { exact: true })).toBeVisible();
  await expect(root.getByText('Step 3', { exact: true })).toBeVisible();

  // Type-to-join: carol (step 3) joins bob (step 2).
  await setSigningOrderValue(root, 2, '2');

  await expect(root.getByText('2 signers · any order')).toBeVisible();
  await expect(root.getByTestId('ungroup-step-button')).toBeVisible();
  await expect(root.getByText('Step 3', { exact: true })).not.toBeVisible();

  const orderInputs = getSigningOrderInputs(root);
  await expect(orderInputs.nth(1)).toHaveValue('2');
  await expect(orderInputs.nth(2)).toHaveValue('2');

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 2],
    ['carol@example.com', 2],
  ]);

  // Groups survive a reload (grouped normalization on load).
  await root.reload();
  await expect(root.getByText('2 signers · any order')).toBeVisible();

  // Ungroup dissolves back into sequential steps.
  await root.getByTestId('ungroup-step-button').click();

  await expect(root.getByText('2 signers · any order')).not.toBeVisible();
  await expect(root.getByText('Step 3', { exact: true })).toBeVisible();

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 2],
    ['carol@example.com', 3],
  ]);

  // Out-of-bounds extraction: bob (step 2) types 4 (> 3 steps) and becomes the
  // last standalone step.
  await setSigningOrderValue(root, 1, '4');

  await expectRecipientOrders(surface, [
    ['alice@example.com', 1],
    ['bob@example.com', 3],
    ['carol@example.com', 2],
  ]);
};

test.describe('document editor', () => {
  test('documents: group recipients via signing order input and ungroup', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runGroupingFlow(surface);
  });
});

test.describe('template editor', () => {
  test('templates: group recipients via signing order input and ungroup', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runGroupingFlow(surface);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:dev -w @documenso/app-tests -- e2e/envelope-editor-v2/envelope-recipient-groups.spec.ts`
Expected: 2 tests pass. If the `Step N` badge text or the group header copy differs from the implementation, fix the spec assertions to match the rendered strings (they are defined in Task 13).

- [ ] **Step 3: Commit**

```bash
git add packages/app-tests/e2e/envelope-editor-v2/envelope-recipient-groups.spec.ts
git commit -m "test: add envelope editor recipient grouping e2e"
```

---

### Task 17: E2E — group signing flow

**Files:**
- Create: `packages/app-tests/e2e/recipient/signing-groups.spec.ts`

Seeds a pending document with orders `[1, 2, 2, 3]` and walks the full flow: waiting-page gating, any-order signing within the group, gate release, completion.

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DocumentSigningOrder, DocumentStatus, FieldType } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { signSignaturePad } from '../fixtures/signature';

type SeededRecipient = Awaited<ReturnType<typeof seedPendingDocumentWithFullFields>>['recipients'][number];

const completeSigning = async (page: Page, recipient: SeededRecipient) => {
  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  for (const field of recipient.fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();

    if (field.type === FieldType.TEXT) {
      await page.locator('#custom-text').fill('TEXT');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(`${signUrl}/complete`);
};

const expectWaiting = async (page: Page, token: string) => {
  await page.goto(`/sign/${token}`);
  await page.waitForURL(`/sign/${token}/waiting`);
};

test('[SIGNING_GROUPS]: group members sign in any order and gate the next step', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: signer1 } = await seedUser();
  const { user: signer2a } = await seedUser();
  const { user: signer2b } = await seedUser();
  const { user: signer3 } = await seedUser();

  const { recipients, document } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: [signer1, signer2a, signer2b, signer3],
    recipientsCreateOptions: [
      { signingOrder: 1 },
      { signingOrder: 2 },
      { signingOrder: 2 },
      { signingOrder: 3 },
    ],
    updateDocumentOptions: {
      documentMeta: {
        upsert: {
          create: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
          update: { signingOrder: DocumentSigningOrder.SEQUENTIAL },
        },
      },
    },
  });

  const [recipient1, recipient2a, recipient2b, recipient3] = recipients;

  // While step 1 is pending, both group members and step 3 are blocked.
  await expectWaiting(page, recipient2a.token);
  await expectWaiting(page, recipient2b.token);
  await expectWaiting(page, recipient3.token);

  await completeSigning(page, recipient1);

  // Step 3 is still blocked; the group is now active.
  await expectWaiting(page, recipient3.token);

  // Sign with the SECOND group member first to prove any-order signing.
  await completeSigning(page, recipient2b);

  // One group member remains — step 3 stays blocked.
  await expectWaiting(page, recipient3.token);

  await completeSigning(page, recipient2a);

  // The whole group is done — step 3 unlocks and completes the document.
  await completeSigning(page, recipient3);

  await expect
    .poll(async () => {
      const envelope = await prisma.envelope.findUniqueOrThrow({
        where: { id: document.id },
      });

      return envelope.status;
    })
    .toBe(DocumentStatus.COMPLETED);
});
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:dev -w @documenso/app-tests -- e2e/recipient/signing-groups.spec.ts`
Expected: 1 test passes. If the post-Complete confirmation dialog has no `Sign` button in this configuration (no dictation), drop the second click — mirror whatever `e2e/document-auth/next-recipient-dictation.spec.ts`'s disabled-dictation test does.

- [ ] **Step 3: Commit**

```bash
git add packages/app-tests/e2e/recipient/signing-groups.spec.ts
git commit -m "test: add signing group flow e2e"
```

---

### Task 18: Final verification

- [ ] **Step 1: Unit tests**

Run: `npm run test -w @documenso/lib`
Expected: all pass.

- [ ] **Step 2: Type checks**

Run: `npx tsc --noEmit` in `packages/lib`, `packages/trpc`, and `apps/remix` (three separate runs, using each as workdir).
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean (run `npm run lint:fix` for autofixable issues).

- [ ] **Step 4: Full E2E for touched areas**

Run: `npm run test:dev -w @documenso/app-tests -- e2e/envelope-editor-v2/ e2e/recipient/signing-groups.spec.ts e2e/document-auth/next-recipient-dictation.spec.ts`
Expected: all pass — the dictation spec proves single-file documents still dictate correctly after the group changes.

- [ ] **Step 5: Commit any remaining fixes**

```bash
git status
git add -A && git commit -m "fix: address verification findings for signing groups"
```

Only commit if there are changes; use a message describing the actual fix.

---

## Coverage map (spec → tasks)

| Spec section | Tasks |
| --- | --- |
| §1 Data model & ordering | 1, 3 |
| §2 Shared pure utilities | 1, 2, 3, 4 |
| §3 Editor UI structure & visuals | 12, 13, 14, 15 |
| §4 Editor interactions (drag, type-to-join, ungroup, locked) | 2, 14, 15 |
| §5.1 Turn checks | 3, 5 |
| §5.2 Initial send | 6 |
| §5.3 Completion advance | 7, 8 (direct template) |
| §5.4 Dictation gating | 3, 7, 8, 10 |
| §5.5 Assistants | 4, 9 |
| §5.6 CSC blocking | 11 |
| §6 Validation & compatibility (grouped load, V1 untouched) | 11 |
| §7 Testing | 1-4 (unit), 16-17 (E2E), 18 |




