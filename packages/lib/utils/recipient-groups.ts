import type { Recipient } from '@prisma/client';
import { SigningStatus } from '@prisma/client';

import type { PositionedRecipient } from './recipients';
import {
  hasSigningOrder,
  isCcRecipient,
  isRecipientBefore,
  isSameSigningStep,
  sortRecipientsBySigningPosition,
} from './recipients';

/**
 * A recipient "step" is the set of non-CC recipients sharing an explicit
 * signing order. A step with 2 or more members is a "signing group": members
 * may act in any order among themselves, and the next step only unlocks once
 * every member of the group has completed their action.
 *
 * A recipient without a signing order is always a single-member step (see
 * `PositionedRecipient`).
 */

type GroupableRecipient = Pick<Recipient, 'role'> & PositionedRecipient;

export type RecipientStep<T> = {
  /**
   * Null for a legacy unordered recipient.
   */
  order: number | null;
  members: T[];
};

export const groupRecipientsBySigningOrder = <T extends GroupableRecipient>(recipients: T[]) => {
  const ccRecipients = recipients.filter((recipient) => isCcRecipient(recipient));
  const nonCcRecipients = sortRecipientsBySigningPosition(recipients.filter((recipient) => !isCcRecipient(recipient)));

  const steps: RecipientStep<T>[] = [];

  for (const recipient of nonCcRecipients) {
    const lastStep = steps[steps.length - 1];

    if (lastStep && lastStep.order !== null && isSameSigningStep(lastStep.members[0], recipient)) {
      lastStep.members.push(recipient);

      continue;
    }

    steps.push({ order: hasSigningOrder(recipient) ? recipient.signingOrder : null, members: [recipient] });
  }

  return { steps, ccRecipients };
};

/**
 * Index of the last step containing a locked (non-updatable) recipient, or -1.
 */
export const getLastLockedStepIndex = <T extends GroupableRecipient>(
  steps: RecipientStep<T>[],
  canUpdateRecipient: (recipient: T) => boolean = () => true,
): number =>
  steps.reduce(
    (lastIndex, step, index) => (step.members.some((member) => !canUpdateRecipient(member)) ? index : lastIndex),
    -1,
  );

/**
 * Numbers sort ahead of unordered recipients, so once a locked recipient holds
 * no order, numbering anything behind it would move that recipient ahead of
 * someone who has already acted. Everything must stay unordered, sequenced by id.
 */
export const isSigningOrderFrozen = <T extends GroupableRecipient>(
  steps: RecipientStep<T>[],
  canUpdateRecipient: (recipient: T) => boolean = () => true,
): boolean => {
  const lastLockedStepIndex = getLastLockedStepIndex(steps, canUpdateRecipient);

  return lastLockedStepIndex !== -1 && steps[lastLockedStepIndex].order === null;
};

/**
 * Dense-renumbers steps to 1..K while preserving groups (duplicate orders).
 *
 * - Locked steps keep their persisted order
 * - Editable steps never collide into a locked step's number
 * - A frozen ordering (see `isSigningOrderFrozen`) is returned untouched
 * - CC recipients move to the tail with an undefined order
 * - The returned array is re-ordered by step sequence
 */
export const normalizeGroupedSigningOrders = <T extends GroupableRecipient>(
  recipients: T[],
  canUpdateRecipient: (recipient: T) => boolean = () => true,
): Array<T & { signingOrder?: number }> => {
  const { steps, ccRecipients } = groupRecipientsBySigningOrder(recipients);

  const lastLockedStepIndex = getLastLockedStepIndex(steps, canUpdateRecipient);
  const isFrozen = isSigningOrderFrozen(steps, canUpdateRecipient);

  let nextOrder = 1;

  const normalizedSteps = steps.map((step, index) => {
    // Locked steps hold persisted orders. Keep them exactly as they are, even
    // when sparse.
    if (isFrozen || index <= lastLockedStepIndex) {
      const order = step.order ?? undefined;

      if (order !== undefined) {
        nextOrder = Math.max(nextOrder, order + 1);
      }

      return { order, members: step.members };
    }

    const order = nextOrder;

    nextOrder += 1;

    return { order, members: step.members };
  });

  return [
    ...normalizedSteps.flatMap((step) => step.members.map((member) => ({ ...member, signingOrder: step.order }))),
    ...ccRecipients.map((recipient) => ({ ...recipient, signingOrder: undefined })),
  ];
};

type EditorRecipient = GroupableRecipient & { formId: string };

/**
 * Editor operations work on the normalized state so every editable step
 * carries a number.
 */
const prepareEditorRecipients = <T extends EditorRecipient>(
  recipients: T[],
  canUpdateRecipient: (recipient: T) => boolean = () => true,
) => {
  const normalized = normalizeGroupedSigningOrders(recipients, canUpdateRecipient);
  const { steps, ccRecipients } = groupRecipientsBySigningOrder(normalized);

  return {
    recipients: normalized,
    steps,
    ccRecipients,
    lastLockedStepIndex: getLastLockedStepIndex(steps, canUpdateRecipient),
    isFrozen: isSigningOrderFrozen(steps, canUpdateRecipient),
  };
};

/**
 * Merges all members of the source step into the target step.
 */
export const mergeSteps = <T extends EditorRecipient>(
  recipients: T[],
  sourceStepIndex: number,
  targetStepIndex: number,
  canUpdateRecipient?: (recipient: T) => boolean,
): Array<T & { signingOrder?: number }> => {
  const prepared = prepareEditorRecipients(recipients, canUpdateRecipient);

  const sourceStep = prepared.steps[sourceStepIndex];
  const targetStep = prepared.steps[targetStepIndex];

  if (
    prepared.isFrozen ||
    !sourceStep ||
    !targetStep ||
    targetStep.order === null ||
    sourceStepIndex === targetStepIndex ||
    sourceStepIndex <= prepared.lastLockedStepIndex ||
    targetStepIndex <= prepared.lastLockedStepIndex
  ) {
    return prepared.recipients;
  }

  const sourceFormIds = new Set(sourceStep.members.map((member) => member.formId));

  // Source members join after the target step's existing members.
  const remaining = prepared.recipients.filter((recipient) => !sourceFormIds.has(recipient.formId));
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
  const prepared = prepareEditorRecipients(recipients, canUpdateRecipient);

  const targetStep = prepared.steps[targetStepIndex];
  const mover = prepared.recipients.find((recipient) => recipient.formId === formId);
  const moverStepIndex = prepared.steps.findIndex((step) => step.members.some((member) => member.formId === formId));

  if (prepared.isFrozen || !targetStep || targetStep.order === null || !mover || isCcRecipient(mover)) {
    return prepared.recipients;
  }

  // Neither the recipient nor the destination may sit in the locked region.
  if (targetStepIndex <= prepared.lastLockedStepIndex || moverStepIndex <= prepared.lastLockedStepIndex) {
    return prepared.recipients;
  }

  if (targetStep.members.some((member) => member.formId === formId)) {
    return prepared.recipients;
  }

  const remaining = prepared.recipients.filter((recipient) => recipient.formId !== formId);
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
 * Extracts a recipient into its own standalone step at the given gap position.
 *
 * - Gap N sits before step N
 * - An out-of-bounds gap appends to the end
 */
export const extractRecipientToNewStep = <T extends EditorRecipient>(
  recipients: T[],
  formId: string,
  insertStepIndex: number,
  canUpdateRecipient?: (recipient: T) => boolean,
): Array<T & { signingOrder?: number }> => {
  const prepared = prepareEditorRecipients(recipients, canUpdateRecipient);

  const mover = prepared.recipients.find((recipient) => recipient.formId === formId);

  if (prepared.isFrozen || !mover || isCcRecipient(mover)) {
    return prepared.recipients;
  }

  const currentStepIndex = prepared.steps.findIndex((step) => step.members.some((member) => member.formId === formId));
  const isSoloStep = currentStepIndex !== -1 && prepared.steps[currentStepIndex].members.length === 1;

  // Dropping a solo step into the gap directly above or below itself is a no-op.
  if (isSoloStep && (insertStepIndex === currentStepIndex || insertStepIndex === currentStepIndex + 1)) {
    return prepared.recipients;
  }

  // Gap N sits before step N, so inserting at or before the last locked step
  // would land the recipient inside the locked region.
  if (insertStepIndex <= prepared.lastLockedStepIndex || currentStepIndex <= prepared.lastLockedStepIndex) {
    return prepared.recipients;
  }

  // Every step past the locked region is numbered after normalization.
  const lastStepOrder = prepared.steps[prepared.steps.length - 1]?.order ?? 0;
  const insertStepOrder = prepared.steps[insertStepIndex]?.order;

  const insertOrder =
    insertStepIndex >= prepared.steps.length || insertStepOrder === null || insertStepOrder === undefined
      ? lastStepOrder + 1
      : insertStepOrder - 0.5;

  const updated = prepared.recipients.map((recipient) =>
    recipient.formId === formId ? { ...recipient, signingOrder: insertOrder } : recipient,
  );

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};

/**
 * Moves a whole step (group) to a new position in the step sequence.
 *
 * - Refused when either end sits in the locked region; only the unlocked
 *   tail can be rearranged.
 */
export const reorderStep = <T extends EditorRecipient>(
  recipients: T[],
  fromStepIndex: number,
  toStepIndex: number,
  canUpdateRecipient: (recipient: T) => boolean = () => true,
): Array<T & { signingOrder?: number }> => {
  const prepared = prepareEditorRecipients(recipients, canUpdateRecipient);

  if (
    prepared.isFrozen ||
    !prepared.steps[fromStepIndex] ||
    fromStepIndex === toStepIndex ||
    fromStepIndex <= prepared.lastLockedStepIndex ||
    toStepIndex <= prepared.lastLockedStepIndex
  ) {
    return prepared.recipients;
  }

  const reorderedSteps = [...prepared.steps];
  const [movedStep] = reorderedSteps.splice(fromStepIndex, 1);

  reorderedSteps.splice(Math.min(toStepIndex, reorderedSteps.length), 0, movedStep);

  // Locked steps cannot be the source or destination, so they keep both their
  // position and their persisted order. The moved tail is numbered above the
  // highest locked order so it still sorts after them.
  const highestLockedOrder = reorderedSteps
    .slice(0, prepared.lastLockedStepIndex + 1)
    .reduce((highest, step) => (step.order === null ? highest : Math.max(highest, step.order)), 0);

  const updated = [
    ...reorderedSteps.flatMap((step, index) => {
      if (index <= prepared.lastLockedStepIndex) {
        return step.members;
      }

      const order = highestLockedOrder + (index - prepared.lastLockedStepIndex);

      return step.members.map((member) => ({ ...member, signingOrder: order }));
    }),
    ...prepared.ccRecipients,
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
  const prepared = prepareEditorRecipients(recipients, canUpdateRecipient);

  const step = prepared.steps[stepIndex];

  // Splitting a locked step would rewrite persisted orders.
  if (
    prepared.isFrozen ||
    !step ||
    step.order === null ||
    step.members.length < 2 ||
    stepIndex <= prepared.lastLockedStepIndex
  ) {
    return prepared.recipients;
  }

  const stepOrder = step.order;
  const offsetByFormId = new Map(step.members.map((member, index) => [member.formId, index]));

  const updated = prepared.recipients.map((recipient) => {
    const offset = offsetByFormId.get(recipient.formId);

    if (offset === undefined) {
      return recipient;
    }

    return { ...recipient, signingOrder: stepOrder + offset / (step.members.length + 1) };
  });

  return normalizeGroupedSigningOrders(updated, canUpdateRecipient);
};

type SignableRecipient = Pick<Recipient, 'role' | 'signingStatus'> & PositionedRecipient;

type SequencingOptions = {
  /**
   * See `isRecipientBefore`. Required for AES/QES envelopes.
   */
  strictlySequential?: boolean;
};

/**
 * Whether it is the recipient's turn to act under SEQUENTIAL signing.
 *
 * - A recipient may act once every non-CC recipient positioned before them has signed.
 * - Recipients sharing an explicit signing order never block each other, unless
 *   `strictlySequential` is set.
 * - Callers must check the document is in SEQUENTIAL mode.
 */
export const isRecipientTurnBySigningOrder = <T extends SignableRecipient>(
  recipients: T[],
  currentRecipient: PositionedRecipient,
  options: SequencingOptions = {},
): boolean =>
  !recipients.some(
    (recipient) =>
      !isCcRecipient(recipient) &&
      recipient.signingStatus !== SigningStatus.SIGNED &&
      isRecipientBefore(recipient, currentRecipient, options),
  );

/**
 * Every pending recipient in the earliest pending step — the "active step".
 *
 * - Two or more members form a signing group and act in parallel, unless
 *   `strictlySequential` is set, in which case only the first member by id is
 *   active.
 * - Pending means non-CC and NOT_SIGNED; rejected recipients are excluded so
 *   the flow never re-activates somebody who declined.
 * - Pass the full recipient list: filtering happens here so every caller
 *   agrees on what "pending" means.
 */
export const getRecipientsInActiveSigningStep = <T extends SignableRecipient>(
  recipients: T[],
  options: SequencingOptions = {},
): T[] => {
  const pendingRecipients = sortRecipientsBySigningPosition(
    recipients.filter((recipient) => !isCcRecipient(recipient) && recipient.signingStatus === SigningStatus.NOT_SIGNED),
  );

  const [first] = pendingRecipients;

  if (!first) {
    return [];
  }

  const activeStep = pendingRecipients.filter(
    (recipient) => recipient === first || isSameSigningStep(recipient, first),
  );

  if (!options.strictlySequential) {
    return activeStep;
  }

  return [
    activeStep.reduce((earliest, recipient) =>
      isRecipientBefore(recipient, earliest, options) ? recipient : earliest,
    ),
  ];
};

/**
 * The single recipient that the current recipient may dictate (rename) on
 * completion, or null when dictation does not apply:
 *
 * - the current recipient must be the last unsigned member of their step, and
 * - the next step must contain exactly one pending recipient.
 */
export const getNextDictatableRecipient = <T extends SignableRecipient & Pick<Recipient, 'id'>>({
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

  const hasUnsignedPeers = recipients.some(
    (recipient) =>
      recipient.id !== currentRecipientId &&
      !isCcRecipient(recipient) &&
      isSameSigningStep(recipient, currentRecipient) &&
      recipient.signingStatus !== SigningStatus.SIGNED,
  );

  if (hasUnsignedPeers) {
    return null;
  }

  // Only the step matters here; `getRecipientsInActiveSigningStep` drops
  // CCs and anyone who has already signed or rejected.
  const laterRecipients = recipients.filter((recipient) => isRecipientBefore(currentRecipient, recipient));

  const nextStep = getRecipientsInActiveSigningStep(laterRecipients);

  if (nextStep.length !== 1) {
    return null;
  }

  return nextStep[0];
};
