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
