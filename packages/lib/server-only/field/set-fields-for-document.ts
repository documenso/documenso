import { prisma } from '@documenso/prisma';
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
  }[];
}

export const setFieldsForDocument = async ({
  userId,
  documentId,
  fields,
}: SetFieldsForDocumentOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
    },
  });

  if (!document) {
    throw new Error('Document not found');
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
    (existingField) =>
      !fields.find(
        (field) =>
          field.id === existingField.id || field.signerEmail === existingField.Recipient?.email,
      ),
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

  const persistedFields = await prisma.$transaction(
    // Disabling as wrapping promises here causes type issues
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    linkedFields.map((field) =>
      prisma.field.upsert({
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
                email: field.signerEmail.toLowerCase(),
              },
            },
          },
        },
      }),
    ),
  );

  if (removedFields.length > 0) {
    await prisma.field.deleteMany({
      where: {
        id: {
          in: removedFields.map((field) => field.id),
        },
      },
    });
  }

  return persistedFields;
};
