import { EnvelopeType } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface DeleteDocumentFieldOptions {
  userId: number;
  teamId: number;
  fieldId: number;
  requestMetadata: ApiRequestMetadata;
  force?: boolean;
}

export const deleteDocumentField = async ({
  userId,
  teamId,
  fieldId,
  requestMetadata,
  force = false,
}: DeleteDocumentFieldOptions) => {
  // Unauthenticated check, we do the real check later.
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: field.envelopeId,
    },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: {
        where: {
          id: field.recipientId,
        },
        include: {
          fields: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document already complete',
    });
  }

  const recipient = envelope.recipients.find((recipient) => recipient.id === field.recipientId);

  if (!recipient) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient for field ${fieldId} not found`,
    });
  }

  // Check whether the recipient associated with the field can have new fields created.
  if (!canRecipientFieldsBeModified(recipient, recipient.fields)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Recipient has already interacted with the document.',
    });
  }

  // Check for dangling visibility references.
  const deletingMeta = field.fieldMeta as { stableId?: string } | null;
  const deletingStableId = deletingMeta?.stableId;

  let danglingRefs: Array<{ id: number; fieldMeta: unknown }> = [];

  if (deletingStableId) {
    const allOtherFields = await prisma.field.findMany({
      where: {
        envelopeId: field.envelopeId,
        id: { not: field.id },
      },
      select: { id: true, fieldMeta: true },
    });

    danglingRefs = allOtherFields.filter((f) => {
      const meta = f.fieldMeta as {
        visibility?: { rules: Array<{ triggerFieldStableId: string }> };
      } | null;
      return (
        meta?.visibility?.rules.some((r) => r.triggerFieldStableId === deletingStableId) ?? false
      );
    });

    if (danglingRefs.length > 0 && !force) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Field is used as a visibility trigger by other fields. Pass force=true to strip those rules.',
      });
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Strip dangling visibility rules from referencing fields before deletion.
    if (danglingRefs.length > 0 && force) {
      for (const ref of danglingRefs) {
        const meta = ref.fieldMeta as {
          visibility: {
            rules: Array<{ triggerFieldStableId: string }>;
            match: 'all' | 'any';
          };
        } & Record<string, unknown>;

        const remaining = meta.visibility.rules.filter(
          (r) => r.triggerFieldStableId !== deletingStableId,
        );

        const newMeta = { ...meta };

        if (remaining.length === 0) {
          delete (newMeta as Record<string, unknown>).visibility;
        } else {
          newMeta.visibility = { ...meta.visibility, rules: remaining };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.field.update({ where: { id: ref.id }, data: { fieldMeta: newMeta as any } });
      }
    }

    const deletedField = await tx.field.delete({
      where: {
        id: fieldId,
        envelopeId: envelope.id,
      },
    });

    // Handle field deleted audit log.
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          fieldId: deletedField.secondaryId,
          fieldRecipientEmail: recipient.email,
          fieldRecipientId: deletedField.recipientId,
          fieldType: deletedField.type,
        },
      }),
    });

    return deletedField;
  });
};
