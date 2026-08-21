import { DocumentSigningOrder, RecipientRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

type AssertAssistantCompatibleSigningOrderOptions = {
  role: RecipientRole;
  signingOrder: DocumentSigningOrder | null | undefined;
};

/**
 * Reject `RecipientRole.ASSISTANT` unless the envelope signs sequentially.
 *
 * The Assistant role exists to pre-fill fields on behalf of downstream
 * signers, which is only meaningful when the assistant is guaranteed to act
 * before them. Under `PARALLEL` signing, `sendDocument` notifies every
 * recipient at once, so signers can sign before the assistant has pre-filled
 * anything, and the assistant's own view is broken: `getRecipientsForAssistant`
 * and `getFieldsForToken` filter with `signingOrder: { gte: assistant.signingOrder ?? 0 }`,
 * which is NULL-false for the null recipient signingOrder the parallel flow
 * carries, leaving the assistant with no recipients and no fields.
 *
 * A `null` / `undefined` signingOrder resolves to `PARALLEL` — the persisted
 * default — matching how `sendDocument` treats a falsy order at distribution
 * time.
 *
 * Schema-layer guard, called from the recipient create/update paths and from
 * the envelope-meta path when flipping an envelope that already carries an
 * assistant.
 */
export const assertAssistantCompatibleSigningOrder = ({
  role,
  signingOrder,
}: AssertAssistantCompatibleSigningOrderOptions): void => {
  if (role !== RecipientRole.ASSISTANT) {
    return;
  }

  const effectiveSigningOrder = signingOrder ?? DocumentSigningOrder.PARALLEL;

  if (effectiveSigningOrder === DocumentSigningOrder.SEQUENTIAL) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message:
      'The ASSISTANT role is only available when sequential signing is enabled — parallel signing notifies every recipient at once, so signers could sign before the assistant has pre-filled their fields.',
  });
};
