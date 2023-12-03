import type { Recipient } from '@documenso/prisma/client';
import { ReadStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';

export const getRecipientType = (recipient: Recipient) => {
  if (
    recipient.role === RecipientRole.CC ||
    recipient.role === RecipientRole.VIEWER ||
    (recipient.sendStatus === SendStatus.SENT && recipient.signingStatus === SigningStatus.SIGNED)
  ) {
    return 'completed';
  }

  if (
    recipient.sendStatus === SendStatus.SENT &&
    recipient.readStatus === ReadStatus.OPENED &&
    recipient.signingStatus === SigningStatus.NOT_SIGNED
  ) {
    return 'opened';
  }

  if (
    recipient.sendStatus === 'SENT' &&
    recipient.signingStatus === 'NOT_SIGNED' &&
    (recipient.role === RecipientRole.SIGNER || recipient.role === RecipientRole.APPROVER)
  ) {
    return 'waiting';
  }

  return 'unsigned';
};
