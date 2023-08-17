import { ReadStatus, Recipient, SendStatus, SigningStatus } from '@documenso/prisma/client';

export const getRecipientType = (recipient: Recipient) => {
  if (
    recipient.sendStatus === SendStatus.SENT &&
    recipient.signingStatus === SigningStatus.SIGNED
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

  if (recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED') {
    return 'waiting';
  }

  return 'unsigned';
};
