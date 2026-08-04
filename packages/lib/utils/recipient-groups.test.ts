import { RecipientRole, SigningStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  extractRecipientToNewStep,
  filterRecipientsInFirstSigningGroup,
  getDictatableNextRecipient,
  groupRecipientsBySigningOrder,
  isRecipientTurnBySigningOrder,
  mergeSteps,
  moveRecipientToStep,
  normalizeGroupedSigningOrders,
  reorderStep,
  ungroupStep,
} from './recipient-groups';

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

    // Gap 2 = before the step containing 'd'.
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
    const recipients = [recipient(1, 1, SigningStatus.REJECTED), recipient(2, 2, SigningStatus.NOT_SIGNED)];

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
