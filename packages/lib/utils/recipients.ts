import type { Envelope } from '@prisma/client';
import { type Field, type Recipient, RecipientRole, SigningStatus } from '@prisma/client';
import { z } from 'zod';

import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { extractLegacyIds } from '../universal/id';

/**
 * Roles that require fields to be assigned before a document can be distributed.
 *
 * Currently only SIGNER requires a signature field.
 */
export const RECIPIENT_ROLES_THAT_REQUIRE_FIELDS = [RecipientRole.SIGNER] as const;

/**
 * Returns recipients who are missing required fields for their role.
 *
 * Currently only SIGNERs are validated - they must have at least one signature field.
 */
export const getRecipientsWithMissingFields = <T extends Pick<Recipient, 'id' | 'role'>>(
  recipients: T[],
  fields: Pick<Field, 'type' | 'recipientId'>[],
): T[] => {
  return recipients.filter((recipient) => {
    if (recipient.role === RecipientRole.SIGNER) {
      const hasSignatureField = fields.some(
        (field) => field.recipientId === recipient.id && isSignatureFieldType(field.type),
      );

      return !hasSignatureField;
    }

    return false;
  });
};

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

export const isRecipientEmailValidForSending = (recipient: Pick<Recipient, 'email'>) => {
  return z.string().email().safeParse(recipient.email).success;
};
