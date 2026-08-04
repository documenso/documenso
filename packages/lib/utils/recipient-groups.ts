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
