import { prisma } from '@documenso/prisma';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

export interface SetFieldsForDocumentOptions {
  userId: number;
  documentId: number;
  fields: {
    id?: number | null;
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
        ...existing,
      };
    })
    .filter((field) => {
      return (
        field.Recipient?.sendStatus !== SendStatus.SENT &&
        field.Recipient?.signingStatus !== SigningStatus.SIGNED
      );
    });

  const persistedFields = await prisma.$transaction(
    linkedFields.map((field) =>
      field.id
        ? prisma.field.update({
            where: {
              id: field.id,
              recipientId: field.recipientId,
              documentId,
            },
            data: {
              type: field.type,
              page: field.pageNumber,
              positionX: field.pageX,
              positionY: field.pageY,
              width: field.pageWidth,
              height: field.pageHeight,
            },
          })
        : prisma.field.create({
            data: {
              // TODO: Rewrite this entire transaction because this is a mess
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              type: field.type!,
              page: field.pageNumber,
              positionX: field.pageX,
              positionY: field.pageY,
              width: field.pageWidth,
              height: field.pageHeight,
              customText: '',
              inserted: false,

              Document: {
                connect: {
                  id: document.id,
                },
              },
              Recipient: {
                connect: {
                  documentId_email: {
                    documentId: document.id,
                    email: field.signerEmail,
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
