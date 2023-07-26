import { Recipient } from '@documenso/prisma/client';

export const getRecipientType = (recipient: Recipient) => {
  if (recipient.sendStatus === 'SENT' && recipient.signingStatus === 'SIGNED') {
    return 'completed';
  }

  if (recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED') {
    return 'waiting';
  }

  return 'unsigned';
};
