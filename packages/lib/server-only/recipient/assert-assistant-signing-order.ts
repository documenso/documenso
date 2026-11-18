import type { DocumentSigningOrder, RecipientRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { hasAssistantWithoutSequentialSigning } from '../../utils/recipients';

type AssertAssistantSigningOrderOptions = {
  signingOrder: DocumentSigningOrder;

  /**
   * The recipients to check.
   */
  recipients: { role?: RecipientRole }[];
};

/**
 * Throws a 400 when an assistant is used without sequential signing.
 *
 * An assistant fills in fields for the recipients after them, which only works
 * if those recipients sign after the assistant.
 */
export const assertAssistantSigningOrder = ({ signingOrder, recipients }: AssertAssistantSigningOrderOptions): void => {
  if (!hasAssistantWithoutSequentialSigning({ recipients, signingOrder })) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_BODY, {
    message: 'Envelopes with an ASSISTANT recipient require a SEQUENTIAL signing order.',
  });
};
