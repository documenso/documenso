import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import {
  type TFieldMetaSchema as FieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffFieldChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { Field } from '@documenso/prisma/client';
import { FieldType, SendStatus, SigningStatus } from '@documenso/prisma/client';

export interface SetFieldsForDocumentOptions {
  userId: number;
  documentId: number;
  fields: {
    id?: number | null;
    type: FieldType;
    signerEmail: string;
    pageNumber: number;
    pageX: number;
    pageY: number;
    pageWidth: number;
    pageHeight: number;
    fieldMeta?: FieldMeta;
  }[];
  requestMetadata?: RequestMetadata;
}

export const setFieldsForDocument = async ({
  userId,
  documentId,
  fields,
  requestMetadata,
}: SetFieldsForDocumentOptions): Promise<Field[]> => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [
        {
          userId,
        },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ],
    },
  });

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.completedAt) {
    throw new Error('Document already complete');
  }

  const existingFields = await prisma.field.findMany({
    where: {
      documentId,
    },
    include: {
      Recipient: true,
    },
  });

  const removedFields = existingFields.filter(
    (existingField) => !fields.find((field) => field.id === existingField.id),
  );

  const linkedFields = fields
    .map((field) => {
      const existing = existingFields.find((existingField) => existingField.id === field.id);

      return {
        ...field,
        _persisted: existing,
      };
    })
    .filter((field) => {
      return (
        field._persisted?.Recipient?.sendStatus !== SendStatus.SENT &&
        field._persisted?.Recipient?.signingStatus !== SigningStatus.SIGNED
      );
    });

  const persistedFields = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      linkedFields.map(async (field) => {
        const fieldSignerEmail = field.signerEmail.toLowerCase();

        const parsedFieldMeta = field.fieldMeta
          ? ZFieldMetaSchema.parse(field.fieldMeta)
          : undefined;

        if (field.type === FieldType.TEXT && field.fieldMeta) {
          const textFieldParsedMeta = ZTextFieldMeta.parse(field.fieldMeta);
          const errors = validateTextField(textFieldParsedMeta.text || '', textFieldParsedMeta);

          if (errors.length > 0) {
            throw new Error(errors.join(', '));
          }
        }

        if (field.type === FieldType.NUMBER && field.fieldMeta) {
          const numberFieldParsedMeta = ZNumberFieldMeta.parse(field.fieldMeta);
          const errors = validateNumberField(
            String(numberFieldParsedMeta.value),
            numberFieldParsedMeta,
          );

          if (errors.length > 0) {
            throw new Error(errors.join(', '));
          }
        }

        if (field.type === FieldType.CHECKBOX) {
          if (field.fieldMeta) {
            const checkboxFieldParsedMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
            const errors = validateCheckboxField(
              checkboxFieldParsedMeta?.values?.map((item) => item.value) ?? [],
              checkboxFieldParsedMeta,
            );

            if (errors.length > 0) {
              throw new Error(errors.join(', '));
            }
          } else {
            throw new Error(
              'To proceed further, please set at least one value for the Checkbox field',
            );
          }
        }

        if (field.type === FieldType.RADIO) {
          if (field.fieldMeta) {
            const radioFieldParsedMeta = ZRadioFieldMeta.parse(field.fieldMeta);
            const checkedRadioFieldValue = radioFieldParsedMeta.values?.find(
              (option) => option.checked,
            )?.value;

            const errors = validateRadioField(checkedRadioFieldValue, radioFieldParsedMeta);

            if (errors.length > 0) {
              throw new Error(errors.join('. '));
            }
          } else {
            throw new Error(
              'To proceed further, please set at least one value for the Radio field',
            );
          }
        }

        if (field.type === FieldType.DROPDOWN) {
          if (field.fieldMeta) {
            const dropdownFieldParsedMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
            const errors = validateDropdownField(undefined, dropdownFieldParsedMeta);

            if (errors.length > 0) {
              throw new Error(errors.join('. '));
            }
          } else {
            throw new Error(
              'To proceed further, please set at least one value for the Dropdown field',
            );
          }
        }

        const upsertedField = await tx.field.upsert({
          where: {
            id: field._persisted?.id ?? -1,
            documentId,
          },
          update: {
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            width: field.pageWidth,
            height: field.pageHeight,
            fieldMeta: parsedFieldMeta,
          },
          create: {
            type: field.type,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            width: field.pageWidth,
            height: field.pageHeight,
            customText: '',
            inserted: false,
            fieldMeta: parsedFieldMeta,
            Document: {
              connect: {
                id: documentId,
              },
            },
            Recipient: {
              connect: {
                documentId_email: {
                  documentId,
                  email: fieldSignerEmail,
                },
              },
            },
          },
        });

        if (upsertedField.recipientId === null) {
          throw new Error('Not possible');
        }

        const baseAuditLog = {
          fieldId: upsertedField.secondaryId,
          fieldRecipientEmail: fieldSignerEmail,
          fieldRecipientId: upsertedField.recipientId,
          fieldType: upsertedField.type,
        };

        const changes = field._persisted ? diffFieldChanges(field._persisted, upsertedField) : [];

        // Handle field updated audit log.
        if (field._persisted && changes.length > 0) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED,
              documentId: documentId,
              user,
              requestMetadata,
              data: {
                changes,
                ...baseAuditLog,
              },
            }),
          });
        }

        // Handle field created audit log.
        if (!field._persisted) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
              documentId: documentId,
              user,
              requestMetadata,
              data: {
                ...baseAuditLog,
              },
            }),
          });
        }

        return upsertedField;
      }),
    );
  });

  if (removedFields.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.field.deleteMany({
        where: {
          id: {
            in: removedFields.map((field) => field.id),
          },
        },
      });

      await tx.documentAuditLog.createMany({
        data: removedFields.map((field) =>
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
            documentId: documentId,
            user,
            requestMetadata,
            data: {
              fieldId: field.secondaryId,
              fieldRecipientEmail: field.Recipient?.email ?? '',
              fieldRecipientId: field.recipientId ?? -1,
              fieldType: field.type,
            },
          }),
        ),
      });
    });
  }

  // Filter out fields that have been removed or have been updated.
  const filteredFields = existingFields.filter((field) => {
    const isRemoved = removedFields.find((removedField) => removedField.id === field.id);
    const isUpdated = persistedFields.find((persistedField) => persistedField.id === field.id);

    return !isRemoved && !isUpdated;
  });

  return [...filteredFields, ...persistedFields];
};
