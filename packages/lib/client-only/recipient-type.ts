import type { Recipient } from '@documenso/prisma/client';
import { ReadStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';

export enum RecipientStatusType {
  COMPLETED = 'completed',
  OPENED = 'opened',
  WAITING = 'waiting',
  UNSIGNED = 'unsigned',
}

export const getRecipientType = (recipient: Recipient) => {
  if (
    recipient.role === RecipientRole.CC ||
    (recipient.sendStatus === SendStatus.SENT && recipient.signingStatus === SigningStatus.SIGNED)
  ) {
    return RecipientStatusType.COMPLETED;
  }

  if (
    recipient.sendStatus === SendStatus.SENT &&
    recipient.readStatus === ReadStatus.OPENED &&
    recipient.signingStatus === SigningStatus.NOT_SIGNED
  ) {
    return RecipientStatusType.OPENED;
  }

  if (
    recipient.sendStatus === SendStatus.SENT &&
    recipient.signingStatus === SigningStatus.NOT_SIGNED
  ) {
    return RecipientStatusType.WAITING;
  }

  return RecipientStatusType.UNSIGNED;
};

export const getExtraRecipientsType = (extraRecipients: Recipient[]) => {
  const types = extraRecipients.map((r) => getRecipientType(r));

  if (types.includes(RecipientStatusType.UNSIGNED)) {
    return RecipientStatusType.UNSIGNED;
  }

  if (types.includes(RecipientStatusType.OPENED)) {
    return RecipientStatusType.OPENED;
  }

  if (types.includes(RecipientStatusType.WAITING)) {
    return RecipientStatusType.WAITING;
  }

  return RecipientStatusType.COMPLETED;
};
