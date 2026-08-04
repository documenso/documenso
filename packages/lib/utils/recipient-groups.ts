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

  // Source members join after the target step's existing members.
  const remaining = recipients.filter((recipient) => !sourceFormIds.has(recipient.formId));
  const lastMemberFormId = targetStep.members[targetStep.members.length - 1].formId;
  const insertAfterIndex = remaining.findIndex((recipient) => recipient.formId === lastMemberFormId);

  const movedMembers = sourceStep.members.map((member) => ({ ...member, signingOrder: targetStep.order }));

  const updated = [
    ...remaining.slice(0, insertAfterIndex + 1),
    ...movedMembers,
    ...remaining.slice(insertAfterIndex + 1),
  ];

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
    insertStepIndex >= steps.length ? (steps[steps.length - 1]?.order ?? 0) + 1 : steps[insertStepIndex].order - 0.5;

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
