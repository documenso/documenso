import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffFieldChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { FieldType } from '@documenso/prisma/client';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

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
  }[];
  requestMetadata?: RequestMetadata;
}

export const setFieldsForDocument = async ({
  userId,
  documentId,
  fields,
  requestMetadata,
}: SetFieldsForDocumentOptions) => {
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
    await Promise.all(
      linkedFields.map(async (field) => {
        const fieldSignerEmail = field.signerEmail.toLowerCase();

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

  return persistedFields;
};
