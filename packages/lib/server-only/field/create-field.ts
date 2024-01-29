import { prisma } from '@documenso/prisma';
import type { FieldType } from '@documenso/prisma/client';

export type CreateFieldOptions = {
  documentId: number;
  recipientId: number;
  type: FieldType;
  pageNumber: number;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
};

export const createField = async ({
  documentId,
  recipientId,
  type,
  pageNumber,
  pageX,
  pageY,
  pageWidth,
  pageHeight,
}: CreateFieldOptions) => {
  const field = await prisma.field.create({
    data: {
      documentId,
      recipientId,
      type,
      page: pageNumber,
      positionX: pageX,
      positionY: pageY,
      width: pageWidth,
      height: pageHeight,
      customText: '',
      inserted: false,
    },
  });

  return field;
};
