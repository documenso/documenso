import type { Recipient } from '@documenso/prisma/client';
import { ReadStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';

export const getRecipientType = (recipient: Recipient) => {
  if (
    recipient.role === RecipientRole.CC ||
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
    recipient.sendStatus === SendStatus.SENT &&
    recipient.signingStatus === SigningStatus.NOT_SIGNED
  ) {
    return 'waiting';
  }

  return 'unsigned';
};

export const getExtraRecipientsType = (extraRecipients: Recipient[]) => {
  const types = extraRecipients.map((r) => getRecipientType(r));

  if (types.includes('unsigned')) {
    return 'unsigned';
  }

  if (types.includes('opened')) {
    return 'opened';
  }

  if (types.includes('waiting')) {
    return 'waiting';
  }

  return 'completed';
};
