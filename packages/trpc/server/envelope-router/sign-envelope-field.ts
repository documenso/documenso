import { isFieldGroupValueShared } from '@documenso/lib/constants/field-groups';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { validateFieldAuth } from '@documenso/lib/server-only/document/validate-field-auth';
import { assertSenderNotDisabled } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import {
  extractFieldInsertionValues,
  extractGroupedCheckboxInsertionValues,
  extractGroupedRadioInsertionValues,
  type FieldInsertionValues,
} from '@documenso/lib/utils/envelope-signing';
import { getRecipientFieldsWhereInput } from '@documenso/lib/utils/recipient-queries';
import { assertRecipientNotExpired } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, type Field, FieldType, RecipientRole, SigningStatus } from '@prisma/client';
import { match } from 'ts-pattern';

import { procedure } from '../trpc';
import { ZSignEnvelopeFieldRequestSchema, ZSignEnvelopeFieldResponseSchema } from './sign-envelope-field.types';

// Note that this is an unauthenticated public procedure route.
export const signEnvelopeFieldRoute = procedure
  .input(ZSignEnvelopeFieldRequestSchema)
  .output(ZSignEnvelopeFieldResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, metadata } = ctx;
    const { token, fieldValues, authOptions } = input;

    // The first field is treated as the primary field which drives auth and signatures.
    const { fieldId, fieldValue } = fieldValues[0];

    // wait 2s to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 1000));

    ctx.logger.info({
      input: {
        fieldId,
        fieldIds: fieldValues.map((value) => value.fieldId),
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        token,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const fields = await prisma.field.findMany({
      where: {
        id: {
          in: fieldValues.map((value) => value.fieldId),
        },
        recipient: getRecipientFieldsWhereInput({
          recipient,
          allowAssistantAccessToOtherRecipients: true,
        }),
      },
      include: {
        envelope: {
          include: {
            recipients: true,
            documentMeta: true,
          },
        },
        recipient: true,
      },
    });

    const field = fields.find((foundField) => foundField.id === fieldId);

    if (!field || fields.length !== fieldValues.length) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field ${fieldId} not found`,
      });
    }

    // Multiple fields may only be signed together when they form a checkbox group.
    if (fields.length > 1) {
      const isValidGroup =
        field.groupId !== null &&
        field.type === FieldType.CHECKBOX &&
        fields.every(
          (groupField) =>
            groupField.groupId === field.groupId &&
            groupField.type === field.type &&
            groupField.recipientId === field.recipientId,
        );

      if (!isValidGroup) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Multiple fields can only be signed together when they belong to the same checkbox group',
        });
      }
    }

    const { envelope } = field;
    const { documentMeta } = envelope;

    await assertSenderNotDisabled({ userId: envelope.userId });

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Envelope ${envelope.id} is not a version 2 envelope`,
      });
    }

    for (const { fieldId: currentFieldId, fieldValue: currentFieldValue } of fieldValues) {
      const currentField = fields.find((foundField) => foundField.id === currentFieldId);

      if (!currentField) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: `Field ${currentFieldId} not found`,
        });
      }

      if (
        currentField.type === FieldType.SIGNATURE &&
        recipient.id !== currentField.recipientId &&
        recipient.role === RecipientRole.ASSISTANT
      ) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: `Assistant recipients cannot sign signature fields`,
        });
      }

      if (currentFieldValue.type !== currentField.type) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Selected values do not match the field values',
        });
      }

      if (currentField.fieldMeta?.readOnly) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: `Field ${currentFieldId} is read only`,
        });
      }
    }

    if (envelope.deletedAt) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} has been deleted`,
      });
    }

    if (envelope.status !== DocumentStatus.PENDING) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} must be pending for signing`,
      });
    }

    // Both are checked because an assistant may insert values into a field belonging to
    // another recipient, and neither signing window may have closed. For every other
    // role these reference the same recipient.
    assertRecipientNotExpired(recipient);
    assertRecipientNotExpired(field.recipient);

    if (recipient.signingStatus === SigningStatus.SIGNED || field.recipient.signingStatus === SigningStatus.SIGNED) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${recipient.id} has already signed`,
      });
    }

    // Unreachable code based on the above query but we need to satisfy TypeScript
    if (field.recipientId === null) {
      throw new Error(`Field ${fieldId} has no recipientId`);
    }

    /*
      Fields in the same group act as a single field. Load any members of the group which
      were not provided in the request so the whole group can be updated together.
    */
    const groupSiblingFields = field.groupId
      ? await prisma.field.findMany({
          where: {
            id: {
              notIn: fields.map((groupField) => groupField.id),
            },
            envelopeId: envelope.id,
            recipientId: field.recipientId,
            groupId: field.groupId,
            type: field.type,
          },
        })
      : [];

    const groupFields: Field[] = [...fields, ...groupSiblingFields];

    const fieldInsertionValues: FieldInsertionValues[] = match({ type: field.type, isGrouped: field.groupId !== null })
      .with({ type: FieldType.RADIO, isGrouped: true }, () => {
        if (fieldValue.type !== FieldType.RADIO) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Selected values do not match the field values',
          });
        }

        return extractGroupedRadioInsertionValues({
          fields: groupFields,
          selectedFieldId: field.id,
          selectedIndex: fieldValue.value,
        });
      })
      .with({ type: FieldType.CHECKBOX, isGrouped: true }, () => {
        return extractGroupedCheckboxInsertionValues({
          fields: groupFields,
          fieldValues: fieldValues.map(({ fieldId: currentFieldId, fieldValue: currentFieldValue }) => {
            if (currentFieldValue.type !== FieldType.CHECKBOX) {
              throw new AppError(AppErrorCode.INVALID_REQUEST, {
                message: 'Selected values do not match the field values',
              });
            }

            return {
              fieldId: currentFieldId,
              value: currentFieldValue.value,
            };
          }),
        });
      })
      .otherwise(() => {
        const insertionValues = extractFieldInsertionValues({ fieldValue, field, documentMeta });

        // Shared value groups apply the same value to every member.
        const fieldsToUpdate = field.groupId && isFieldGroupValueShared(field.type) ? groupFields : [field];

        return fieldsToUpdate.map((fieldToUpdate) => ({
          fieldId: fieldToUpdate.id,
          ...insertionValues,
        }));
      });

    const isUninserting = fieldInsertionValues.every((insertionValues) => !insertionValues.inserted);

    // Early return for uninserting fields.
    if (isUninserting) {
      return await prisma.$transaction(async (tx) => {
        const updatedFields = await Promise.all(
          fieldInsertionValues.map(async (insertionValues) =>
            tx.field.update({
              where: {
                id: insertionValues.fieldId,
              },
              data: {
                customText: '',
                inserted: false,
              },
            }),
          ),
        );

        await tx.signature.deleteMany({
          where: {
            fieldId: field.id,
          },
        });

        if (recipient.role !== RecipientRole.ASSISTANT) {
          await tx.documentAuditLog.createMany({
            data: updatedFields.map((uninsertedField) =>
              createDocumentAuditLogData({
                type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
                envelopeId: envelope.id,
                user: {
                  name: recipient.name,
                  email: recipient.email,
                },
                requestMetadata: metadata.requestMetadata,
                data: {
                  field: uninsertedField.type,
                  fieldId: uninsertedField.secondaryId,
                },
              }),
            ),
          });
        }

        return {
          signedFields: updatedFields,
        };
      });
    }

    const derivedRecipientActionAuth = await validateFieldAuth({
      documentAuthOptions: envelope.authOptions,
      recipient,
      field,
      userId: user?.id,
      authOptions,
    });

    const assistant = recipient.role === RecipientRole.ASSISTANT ? recipient : undefined;

    let signatureImageAsBase64 = null;
    let typedSignature = null;

    if (field.type === FieldType.SIGNATURE) {
      if (fieldValue.type !== FieldType.SIGNATURE) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: `Field ${fieldId} is not a signature field`,
        });
      }

      if (fieldValue.value) {
        const isBase64 = isBase64Image(fieldValue.value);

        signatureImageAsBase64 = isBase64 ? fieldValue.value : null;
        typedSignature = !isBase64 ? fieldValue.value : null;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updatedFields = await Promise.all(
        fieldInsertionValues.map(async (insertionValues) =>
          tx.field.update({
            where: {
              id: insertionValues.fieldId,
            },
            data: {
              customText: insertionValues.customText,
              inserted: insertionValues.inserted,
            },
            include: {
              signature: true,
            },
          }),
        ),
      );

      const updatedField = resolvePrimaryField(updatedFields, field.id);

      if (field.type === FieldType.SIGNATURE) {
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

      await tx.documentAuditLog.createMany({
        data: updatedFields.map((insertedField) =>
          createDocumentAuditLogData({
            type:
              assistant && field.recipientId !== assistant.id
                ? DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED
                : DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
            envelopeId: envelope.id,
            user: {
              email: assistant?.email ?? recipient.email,
              name: assistant?.name ?? recipient.name,
            },
            requestMetadata: metadata.requestMetadata,
            data: {
              recipientEmail: recipient.email,
              recipientId: recipient.id,
              recipientName: recipient.name,
              recipientRole: recipient.role,
              fieldId: insertedField.secondaryId,
              field: match(insertedField.type)
                .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, (type) => ({
                  type,
                  data: signatureImageAsBase64 || typedSignature || '',
                }))
                .with(FieldType.DATE, FieldType.EMAIL, FieldType.NAME, FieldType.TEXT, FieldType.INITIALS, (type) => ({
                  type,
                  data: insertedField.customText,
                }))
                .with(FieldType.NUMBER, FieldType.RADIO, FieldType.CHECKBOX, FieldType.DROPDOWN, (type) => ({
                  type,
                  data: insertedField.customText,
                }))
                .exhaustive(),
              fieldSecurity: derivedRecipientActionAuth
                ? {
                    type: derivedRecipientActionAuth,
                  }
                : undefined,
            },
          }),
        ),
      });

      return {
        signedFields: updatedFields,
      };
    });
  });

const resolvePrimaryField = <T extends { id: number }>(updatedFields: T[], primaryFieldId: number): T => {
  const primaryField = updatedFields.find((updatedField) => updatedField.id === primaryFieldId);

  if (!primaryField) {
    throw new Error('Not possible');
  }

  return primaryField;
};
