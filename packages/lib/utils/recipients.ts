import type { Envelope } from '@prisma/client';
import { type Field, type Recipient, RecipientRole, SigningStatus } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { extractLegacyIds } from '../universal/id';

export const formatSigningLink = (token: string) => `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${token}`;

/**
 * Whether a recipient can be modified by the document owner.
 */
export const canRecipientBeModified = (recipient: Recipient, fields: Field[]) => {
  if (!recipient) {
    return false;
  }

  // CCers can always be modified (unless document is completed).
  if (recipient.role === RecipientRole.CC) {
    return true;
  }

  // Deny if the recipient has already signed the document.
  if (recipient.signingStatus === SigningStatus.SIGNED) {
    return false;
  }

  // Deny if the recipient has inserted any fields.
  if (fields.some((field) => field.recipientId === recipient.id && field.inserted)) {
    return false;
  }

  return true;
};

/**
 * Whether a recipient can have their fields modified by the document owner.
 *
 * A recipient can their fields modified if all the conditions are met:
 * - They are not a Viewer or CCer
 * - They can be modified (canRecipientBeModified)
 */
export const canRecipientFieldsBeModified = (recipient: Recipient, fields: Field[]) => {
  if (!canRecipientBeModified(recipient, fields)) {
    return false;
  }

  return recipient.role !== RecipientRole.VIEWER && recipient.role !== RecipientRole.CC;
};

export const mapRecipientToLegacyRecipient = (
  recipient: Recipient,
  envelope: Pick<Envelope, 'type' | 'secondaryId'>,
) => {
  const legacyId = extractLegacyIds(envelope);

  return {
    ...recipient,
    ...legacyId,
  };
};
