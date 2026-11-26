import { prisma } from '@documenso/prisma';
import { DocumentStatus, FieldType, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '../../constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '../../constants/time-zones';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { TRecipientActionAuth } from '../../types/document-auth';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { assertLegacyFieldValueAllowed } from '../../utils/legacy-field-signing';
import { getRecipientFieldsWhereInput } from '../../utils/recipient-queries';
import { assertRecipientNotExpired } from '../../utils/recipients';
import { validateFieldAuth } from '../document/validate-field-auth';
import { assertSenderNotDisabled } from '../user/assert-user-not-disabled';
import { lockFieldForSigning } from './lock-field-for-signing';

export type SignFieldWithTokenOptions = {
  token: string;
  fieldId: number;
  value: string;
  isBase64?: boolean;
  userId?: number;
  authOptions?: TRecipientActionAuth;
  requestMetadata?: RequestMetadata;
};

/**
 * Please read.
 *
 * Content within this function has been duplicated in the
 * createDocumentFromDirectTemplate file.
 *
 * Any update to this should be reflected in the other file if required. Which values a field
 * accepts is shared through `assertLegacyFieldValueAllowed`.
 *
 * Todo: Extract common logic.
 */
export const signFieldWithToken = async ({
  token,
  fieldId,
  value,
  isBase64,
  userId,
  authOptions,
  requestMetadata,
}: SignFieldWithTokenOptions) => {
  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      token,
    },
  });

  const field = await prisma.field.findFirstOrThrow({
    where: {
      id: fieldId,
      recipient: getRecipientFieldsWhereInput({
        recipient,
        allowAssistantAccessToOtherRecipients: true,
      }),
    },
    include: {
      envelope: {
        include: {
          recipients: true,
        },
      },
      recipient: true,
    },
  });

  const { envelope } = field;

  if (!envelope) {
    throw new Error(`Document not found for field ${field.id}`);
  }

  if (!recipient) {
    throw new Error(`Recipient not found for field ${field.id}`);
  }

  await assertSenderNotDisabled({ userId: envelope.userId });

  if (envelope.internalVersion !== 1) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Envelope ${envelope.id} is not a version 1 envelope`,
    });
  }

  if (envelope.deletedAt) {
    throw new Error(`Document ${envelope.id} has been deleted`);
  }

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new Error(`Document ${envelope.id} must be pending for signing`);
  }

  assertRecipientNotExpired(recipient);

  if (recipient.signingStatus === SigningStatus.SIGNED || field.recipient.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  if (field.inserted) {
    throw new Error(`Field ${fieldId} has already been inserted`);
  }

  // Unreachable code based on the above query but we need to satisfy TypeScript
  if (field.recipientId === null) {
    throw new Error(`Field ${fieldId} has no recipientId`);
  }

  if (
    field.type === FieldType.SIGNATURE &&
    recipient.role === RecipientRole.ASSISTANT &&
    field.recipientId !== recipient.id
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Assistant recipients cannot sign signature fields',
    });
  }

  const documentMeta = await prisma.documentMeta.findFirst({
    where: {
      envelope: {
        id: envelope.id,
      },
    },
  });

  assertLegacyFieldValueAllowed({
    field,
    value,
    isBase64,
    typedSignatureEnabled: documentMeta?.typedSignatureEnabled,
  });

  const derivedRecipientActionAuth = await validateFieldAuth({
    documentAuthOptions: envelope.authOptions,
    recipient,
    field,
    userId,
    authOptions,
  });

  const isSignatureField = field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE;

  let customText = !isSignatureField ? value : undefined;

  const signatureImageAsBase64 = isSignatureField && isBase64 ? value : undefined;
  const typedSignature = isSignatureField && !isBase64 ? value : undefined;

  if (field.type === FieldType.DATE) {
    customText = DateTime.now()
      .setZone(documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
      .toFormat(documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);
  }

  const assistant = recipient.role === RecipientRole.ASSISTANT ? recipient : undefined;

  return await prisma.$transaction(async (tx) => {
    const { field: lockedField } = await lockFieldForSigning(tx, {
      envelopeId: envelope.id,
      fieldId: field.id,
      recipientId: recipient.id,
    });

    if (lockedField.inserted) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Field ${fieldId} has already been inserted`,
      });
    }

    const updatedField = await tx.field.update({
      where: {
        id: field.id,
      },
      data: {
        customText,
        inserted: true,
      },
    });

    if (isSignatureField) {
      const signature = await tx.signature.upsert({
        where: {
          fieldId: field.id,
        },
        create: {
          fieldId: field.id,
          recipientId: field.recipientId,
          signatureImageAsBase64: signatureImageAsBase64,
          typedSignature: typedSignature,
        },
        update: {
          signatureImageAsBase64: signatureImageAsBase64,
          typedSignature: typedSignature,
        },
      });

      // Dirty but I don't want to deal with type information
      Object.assign(updatedField, {
        signature,
      });
    }

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type:
          assistant && field.recipientId !== assistant.id
            ? DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED
            : DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
        envelopeId: envelope.id,
        user: {
          email: assistant?.email ?? recipient.email,
          name: assistant?.name ?? recipient.name,
        },
        requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientId: recipient.id,
          recipientName: recipient.name,
          recipientRole: recipient.role,
          fieldId: updatedField.secondaryId,
          field: match(updatedField.type)
            .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, (type) => ({
              type,
              data: signatureImageAsBase64 || typedSignature || '',
            }))
            .with(FieldType.DATE, FieldType.EMAIL, FieldType.NAME, FieldType.TEXT, FieldType.INITIALS, (type) => ({
              type,
              data: updatedField.customText,
            }))
            .with(FieldType.NUMBER, FieldType.RADIO, FieldType.CHECKBOX, FieldType.DROPDOWN, (type) => ({
              type,
              data: updatedField.customText,
            }))
            .exhaustive(),
          fieldSecurity: derivedRecipientActionAuth
            ? {
                type: derivedRecipientActionAuth,
              }
            : undefined,
        },
      }),
    });

    return updatedField;
  });
};
