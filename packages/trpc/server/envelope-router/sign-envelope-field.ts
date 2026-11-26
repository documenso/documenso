import { isFieldGroupValueShared } from '@documenso/lib/constants/field-groups';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { validateFieldAuth } from '@documenso/lib/server-only/document/validate-field-auth';
import { lockFieldForSigning } from '@documenso/lib/server-only/field/lock-field-for-signing';
import { assertSenderNotDisabled } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import {
  type ExtractFieldInsertionValuesOptions,
  extractFieldInsertionValues,
  extractGroupedCheckboxInsertionValues,
  extractGroupedRadioInsertionValues,
  type FieldInsertionValues,
} from '@documenso/lib/utils/envelope-signing';
import { getRecipientFieldsWhereInput } from '@documenso/lib/utils/recipient-queries';
import { assertRecipientNotExpired } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, type Field, FieldType, type Recipient, RecipientRole, SigningStatus } from '@prisma/client';
import { match } from 'ts-pattern';

import { procedure } from '../trpc';
import {
  type TSignEnvelopeFieldValue,
  ZSignEnvelopeFieldRequestSchema,
  ZSignEnvelopeFieldResponseSchema,
} from './sign-envelope-field.types';

// Note that this is an unauthenticated public procedure route.
export const signEnvelopeFieldRoute = procedure
  .input(ZSignEnvelopeFieldRequestSchema)
  .output(ZSignEnvelopeFieldResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, metadata } = ctx;
    const { token, fieldId, fieldValue, authOptions } = input;

    ctx.logger.info({
      input: {
        fieldId,
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

    const field = await prisma.field.findFirst({
      where: {
        id: fieldId,
        envelopeId: recipient.envelopeId,
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

    if (!field) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field ${fieldId} not found`,
      });
    }

    const { envelope } = field;
    const { documentMeta } = envelope;

    await assertSenderNotDisabled({ userId: envelope.userId });

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Envelope ${envelope.id} is not a version 2 envelope`,
      });
    }

    assertFieldAcceptsValue({ recipient, field, fieldValue });

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

    // Action auth is slow, so it runs before the envelope is locked. It only applies to
    // signature fields, which cannot be grouped, so whether this request inserts or clears
    // the field is known from the request alone.
    const isClearingSignature = fieldValue.type === FieldType.SIGNATURE && !fieldValue.value;

    const derivedRecipientActionAuth = isClearingSignature
      ? undefined
      : await validateFieldAuth({
          documentAuthOptions: envelope.authOptions,
          recipient,
          field,
          userId: user?.id,
          authOptions,
        });

    let signatureImageAsBase64 = null;
    let typedSignature = null;

    if (fieldValue.type === FieldType.SIGNATURE && fieldValue.value) {
      const isBase64 = isBase64Image(fieldValue.value);

      signatureImageAsBase64 = isBase64 ? fieldValue.value : null;
      typedSignature = !isBase64 ? fieldValue.value : null;
    }

    return await prisma.$transaction(async (tx) => {
      const { recipient: lockedRecipient, field: lockedField } = await lockFieldForSigning(tx, {
        envelopeId: envelope.id,
        fieldId: field.id,
        recipientId: recipient.id,
      });

      assertFieldAcceptsValue({ recipient: lockedRecipient, field: lockedField, fieldValue });

      const assistant = lockedRecipient.role === RecipientRole.ASSISTANT ? lockedRecipient : undefined;

      let groupFields: Field[] = [lockedField];

      // Load all the fields in the group if available. This includes the field itself, since
      // it matches every condition.
      if (lockedField.groupId) {
        groupFields = await tx.field.findMany({
          where: {
            envelopeId: envelope.id,
            recipientId: lockedField.recipientId,
            groupId: lockedField.groupId,
            type: lockedField.type,
          },
          orderBy: {
            id: 'asc',
          },
        });
      }

      const fieldInsertionValues = extractSignedFieldInsertionValues({
        field: lockedField,
        groupFields,
        fieldValue,
        documentMeta,
      });

      // Signing a field of a group writes every field in the group. Only the field which was
      // signed, and the fields whose value changes with it, are recorded in the audit log.
      const fieldIdsToLog = fieldInsertionValues
        .filter((insertionValues) => {
          const previousField = groupFields.find((groupField) => groupField.id === insertionValues.fieldId);

          return insertionValues.fieldId === lockedField.id || insertionValues.customText !== previousField?.customText;
        })
        .map((insertionValues) => insertionValues.fieldId);

      const isUninserting = fieldInsertionValues.every((insertionValues) => !insertionValues.inserted);

      if (isUninserting) {
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
            fieldId: lockedField.id,
          },
        });

        const uninsertedFields = updatedFields.filter((updatedField) => fieldIdsToLog.includes(updatedField.id));

        if (!assistant) {
          await tx.documentAuditLog.createMany({
            data: uninsertedFields.map((uninsertedField) =>
              createDocumentAuditLogData({
                type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
                envelopeId: envelope.id,
                user: {
                  name: lockedRecipient.name,
                  email: lockedRecipient.email,
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
          // Clients merge the response into their local fields, so the deleted signature
          // must be returned as null rather than omitted.
          signedFields: updatedFields.map((updatedField) => ({ ...updatedField, signature: null })),
        };
      }

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

      const updatedField = updatedFields.find((currentField) => currentField.id === lockedField.id);

      if (!updatedField) {
        throw new Error('Not possible');
      }

      // Update the signature and mutate the response to contain
      // the new signature for the updated field.
      if (lockedField.type === FieldType.SIGNATURE) {
        const signature = await tx.signature.upsert({
          where: {
            fieldId: lockedField.id,
          },
          create: {
            fieldId: lockedField.id,
            recipientId: lockedField.recipientId,
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

      const isOptionGroup =
        Boolean(lockedField.groupId) &&
        (lockedField.type === FieldType.RADIO || lockedField.type === FieldType.CHECKBOX);

      // A field of a radio or checkbox group can lose its value while its group stays answered,
      // such as a radio whose selection moved to another field of the group. It is logged as
      // unsigned. Any other field signed with an empty value is still inserted, so it is logged
      // as an insertion.
      const clearedFields = isOptionGroup
        ? updatedFields.filter((updatedField) => {
            const previousField = groupFields.find((groupField) => groupField.id === updatedField.id);

            return Boolean(previousField?.customText) && !updatedField.customText;
          })
        : [];

      const insertedFields = updatedFields.filter(
        (updatedField) => fieldIdsToLog.includes(updatedField.id) && !clearedFields.includes(updatedField),
      );

      await tx.documentAuditLog.createMany({
        data: insertedFields.map((insertedField) =>
          createDocumentAuditLogData({
            type:
              assistant && lockedField.recipientId !== assistant.id
                ? DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED
                : DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
            envelopeId: envelope.id,
            user: {
              email: assistant?.email ?? lockedRecipient.email,
              name: assistant?.name ?? lockedRecipient.name,
            },
            requestMetadata: metadata.requestMetadata,
            data: {
              recipientEmail: lockedRecipient.email,
              recipientId: lockedRecipient.id,
              recipientName: lockedRecipient.name,
              recipientRole: lockedRecipient.role,
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

      // Clearing a field is not logged for assistants. Not sure why, just basing this off
      // how it was previously done.
      if (!assistant) {
        await tx.documentAuditLog.createMany({
          data: clearedFields.map((clearedField) =>
            createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
              envelopeId: envelope.id,
              user: {
                name: lockedRecipient.name,
                email: lockedRecipient.email,
              },
              requestMetadata: metadata.requestMetadata,
              data: {
                field: clearedField.type,
                fieldId: clearedField.secondaryId,
              },
            }),
          ),
        });
      }

      return {
        signedFields: updatedFields,
      };
    });
  });

type AssertFieldAcceptsValueOptions = {
  recipient: Pick<Recipient, 'id' | 'role'>;
  field: Pick<Field, 'id' | 'type' | 'recipientId' | 'fieldMeta'>;
  fieldValue: TSignEnvelopeFieldValue;
};

const assertFieldAcceptsValue = ({ recipient, field, fieldValue }: AssertFieldAcceptsValueOptions) => {
  if (
    field.type === FieldType.SIGNATURE &&
    recipient.id !== field.recipientId &&
    recipient.role === RecipientRole.ASSISTANT
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Assistant recipients cannot sign signature fields`,
    });
  }

  if (fieldValue.type !== field.type) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Selected values do not match the field values',
    });
  }

  if (field.fieldMeta?.readOnly) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Field ${field.id} is read only`,
    });
  }
};

type ExtractSignedFieldInsertionValuesOptions = {
  field: Field;
  /** Every field in the field's group, or only the field itself if it is not grouped. */
  groupFields: Field[];
  fieldValue: TSignEnvelopeFieldValue;
  documentMeta: ExtractFieldInsertionValuesOptions['documentMeta'];
};

const extractSignedFieldInsertionValues = ({
  field,
  groupFields,
  fieldValue,
  documentMeta,
}: ExtractSignedFieldInsertionValuesOptions): FieldInsertionValues[] =>
  match({ type: field.type, isGrouped: Boolean(field.groupId) })
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
      if (fieldValue.type !== FieldType.CHECKBOX) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Selected values do not match the field values',
        });
      }

      return extractGroupedCheckboxInsertionValues({
        fields: groupFields,
        selectedFieldId: field.id,
        selectedIndices: fieldValue.value,
      });
    })
    .otherwise(() => {
      const insertionValues = extractFieldInsertionValues({ fieldValue, field, documentMeta });

      // Shared value groups apply the same value to every field.
      const fieldsToUpdate = field.groupId && isFieldGroupValueShared(field.type) ? groupFields : [field];

      return fieldsToUpdate.map((fieldToUpdate) => ({
        fieldId: fieldToUpdate.id,
        ...insertionValues,
      }));
    });
