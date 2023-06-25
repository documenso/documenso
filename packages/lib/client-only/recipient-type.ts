import { Recipient } from '@documenso/prisma/client';

export const type = (recipient: Recipient) =>
  recipient.sendStatus === 'SENT' && recipient.signingStatus === 'SIGNED'
    ? 'completed'
    : recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED'
    ? 'waiting'
    : 'unsigned';
