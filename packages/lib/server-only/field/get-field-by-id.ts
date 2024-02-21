import { prisma } from '@documenso/prisma';

export type GetFieldByIdOptions = {
  fieldId: number;
  documentId: number;
};

export const getFieldById = async ({ fieldId, documentId }: GetFieldByIdOptions) => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      documentId,
    },
  });

  return field;
};
