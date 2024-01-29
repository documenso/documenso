import { prisma } from '@documenso/prisma';
import type { FieldType } from '@documenso/prisma/client';

export type UpdateFieldOptions = {
  fieldId: number;
  documentId: number;
  recipientId?: number;
  type?: FieldType;
  pageNumber?: number;
  pageX?: number;
  pageY?: number;
  pageWidth?: number;
  pageHeight?: number;
};

export const updateField = async ({
  fieldId,
  documentId,
  recipientId,
  type,
  pageNumber,
  pageX,
  pageY,
  pageWidth,
  pageHeight,
}: UpdateFieldOptions) => {
  const field = await prisma.field.update({
    where: {
      id: fieldId,
      documentId,
    },
    data: {
      recipientId,
      type,
      page: pageNumber,
      positionX: pageX,
      positionY: pageY,
      width: pageWidth,
      height: pageHeight,
    },
  });

  return field;
};
