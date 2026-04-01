import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';

import { ZGenericSuccessResponse } from '../../schema';
import { authenticatedProcedure } from '../../trpc';
import {
  ZDeleteEnvelopeFieldRequestSchema,
  ZDeleteEnvelopeFieldResponseSchema,
  deleteEnvelopeFieldMeta,
} from './delete-envelope-field.types';

export const deleteEnvelopeFieldRoute = authenticatedProcedure
  .meta(deleteEnvelopeFieldMeta)
  .input(ZDeleteEnvelopeFieldRequestSchema)
  .output(ZDeleteEnvelopeFieldResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { fieldId } = input;

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    const unsafeField = await prisma.field.findUnique({
      where: {
        id: fieldId,
      },
      select: {
        envelopeId: true,
      },
    });

    if (!unsafeField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Field not found',
      });
    }

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: unsafeField.envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: {
          include: {
            fields: true,
          },
        },
      },
    });

    const recipientWithFields = envelope?.recipients.find((recipient) =>
      recipient.fields.some((field) => field.id === fieldId),
    );
    const fieldToDelete = recipientWithFields?.fields.find((field) => field.id === fieldId);

    if (!envelope || !recipientWithFields || !fieldToDelete) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Field not found',
      });
    }

    if (envelope.completedAt) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope already complete',
      });
    }

    // Check whether the recipient associated with the field can have new fields created.
    if (!canRecipientFieldsBeModified(recipientWithFields, recipientWithFields.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Recipient has already interacted with the document.',
      });
    }

    await prisma.$transaction(async (tx) => {
      const deletedField = await tx.field.delete({
        where: {
          id: fieldToDelete.id,
          envelopeId: envelope.id,
        },
      });

      // Handle field deleted audit log.
      if (envelope.type === EnvelopeType.DOCUMENT) {
        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
            envelopeId: envelope.id,
            metadata,
            data: {
              fieldId: deletedField.secondaryId,
              fieldRecipientEmail: recipientWithFields.email,
              fieldRecipientId: deletedField.recipientId,
              fieldType: deletedField.type,
            },
          }),
        });
      }

      return deletedField;
    });

    return ZGenericSuccessResponse;
  });
