import { type Field, type Recipient, RecipientRole, SigningStatus } from '@documenso/prisma/client';

/**
 * Whether a recipient can be modified by the document owner.
 */
export const canRecipientBeModified = (recipient: Recipient, fields: Field[]) => {
  // Deny if the recipient has already signed the document.
  if (!recipient || recipient.signingStatus === SigningStatus.SIGNED) {
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
