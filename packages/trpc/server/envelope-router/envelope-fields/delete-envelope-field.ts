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
    const { fieldId, force } = input;

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

    // Check for dangling visibility references.
    const deletingMeta = fieldToDelete.fieldMeta as { stableId?: string } | null;
    const deletingStableId = deletingMeta?.stableId;

    let danglingRefs: Array<{ id: number; fieldMeta: unknown }> = [];

    if (deletingStableId) {
      const allOtherFields = await prisma.field.findMany({
        where: {
          envelopeId: envelope.id,
          id: { not: fieldToDelete.id },
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

    await prisma.$transaction(async (tx) => {
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

          await tx.field.update({
            where: { id: ref.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { fieldMeta: newMeta as unknown as any },
          });
        }
      }

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
