import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { Envelope } from '@prisma/client';
import { type Field, RecipientRole, SigningStatus } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import { AppError, AppErrorCode } from '../errors/app-error';
import type { TRecipientLite } from '../types/recipient';
import { extractLegacyIds } from '../universal/id';
import { zEmail } from './zod';

type RecipientWithSigningOrder = {
  role: RecipientRole;
  signingOrder?: number | null;
};

type CanUpdateRecipient<T extends RecipientWithSigningOrder> = (recipient: T) => boolean;

const canUpdateAnyRecipient = () => true;

/**
 * Roles that require fields to be assigned before a document can be distributed.
 *
 * Currently only SIGNER requires a signature field.
 */
export const RECIPIENT_ROLES_THAT_REQUIRE_FIELDS = [RecipientRole.SIGNER] as const;

export const isCcRecipient = (recipient: Pick<RecipientWithSigningOrder, 'role'>) => {
  return recipient.role === RecipientRole.CC;
};

export const getRecipientSigningOrder = (recipient: Pick<RecipientWithSigningOrder, 'role' | 'signingOrder'>) => {
  if (isCcRecipient(recipient)) {
    return null;
  }

  return recipient.signingOrder ?? null;
};

export const sortRecipientsForSigningOrder = <T extends RecipientWithSigningOrder>(recipients: T[]): T[] => {
  return [...recipients].sort((r1, r2) => {
    const r1IsCcRecipient = isCcRecipient(r1);
    const r2IsCcRecipient = isCcRecipient(r2);

    // CC recipients always sort after non-CC recipients.
    if (r1IsCcRecipient !== r2IsCcRecipient) {
      return r1IsCcRecipient ? 1 : -1;
    }

    // Order by signing order; missing orders sort last.
    const r1SigningOrder = r1.signingOrder ?? Number.MAX_SAFE_INTEGER;
    const r2SigningOrder = r2.signingOrder ?? Number.MAX_SAFE_INTEGER;

    return r1SigningOrder - r2SigningOrder;
  });
};

export const normalizeRecipientSigningOrders = <T extends RecipientWithSigningOrder>(
  recipients: T[],
  canUpdateRecipient: CanUpdateRecipient<T> = canUpdateAnyRecipient,
): Array<T & { signingOrder?: number }> => {
  const recipientsWithSigningOrder = recipients.filter((recipient) => !isCcRecipient(recipient));
  const ccRecipients = recipients.filter((recipient) => isCcRecipient(recipient));

  const normalizedRecipients = recipientsWithSigningOrder.map((recipient, index) => ({
    ...recipient,
    signingOrder: canUpdateRecipient(recipient) ? index + 1 : (recipient.signingOrder ?? index + 1),
  }));

  const normalizedCcRecipients = ccRecipients.map((recipient) => ({
    ...recipient,
    signingOrder: undefined,
  }));

  return [...normalizedRecipients, ...normalizedCcRecipients];
};

/**
 * Returns recipients who are missing required fields for their role.
 *
 * Currently only SIGNERs are validated - they must have at least one signature field.
 */
export const getRecipientsWithMissingFields = <T extends Pick<TRecipientLite, 'id' | 'role'>>(
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
export const canRecipientBeModified = (
  recipient: TRecipientLite,
  fields: Pick<Field, 'recipientId' | 'inserted'>[],
) => {
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
export const canRecipientFieldsBeModified = (
  recipient: TRecipientLite,
  fields: Pick<Field, 'recipientId' | 'inserted'>[],
) => {
  if (!canRecipientBeModified(recipient, fields)) {
    return false;
  }

  return recipient.role !== RecipientRole.VIEWER && recipient.role !== RecipientRole.CC;
};

export const mapRecipientToLegacyRecipient = (
  recipient: TRecipientLite,
  envelope: Pick<Envelope, 'type' | 'secondaryId'>,
) => {
  const legacyId = extractLegacyIds(envelope);

  return {
    ...recipient,
    ...legacyId,
  };
};

export const findRecipientByEmail = <T extends { email: string }>({
  recipients,
  userEmail,
  teamEmail,
}: {
  recipients: T[];
  userEmail: string;
  teamEmail?: string | null;
}) => recipients.find((r) => r.email === userEmail || (teamEmail && r.email === teamEmail));

export const isRecipientEmailValidForSending = (recipient: Pick<TRecipientLite, 'email'>) => {
  return zEmail().safeParse(recipient.email).success;
};

/**
 * Whether the recipient's signing window has expired.
 */
export const isRecipientExpired = (recipient: { expiresAt: Date | null }) => {
  return Boolean(recipient.expiresAt && new Date(recipient.expiresAt) <= new Date());
};

/**
 * Asserts that the recipient's signing window has not expired.
 *
 * Throws an AppError with RECIPIENT_EXPIRED if the expiration date has passed.
 */
export const assertRecipientNotExpired = (recipient: { expiresAt: Date | null }) => {
  if (isRecipientExpired(recipient)) {
    throw new AppError(AppErrorCode.RECIPIENT_EXPIRED, {
      message: 'Recipient signing window has expired',
    });
  }
};
