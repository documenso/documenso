import { prisma } from '@documenso/prisma';

export type DeleteFieldOptions = {
  fieldId: number;
  documentId: number;
};

export const deleteField = async ({ fieldId, documentId }: DeleteFieldOptions) => {
  const field = await prisma.field.delete({
    where: {
      id: fieldId,
      documentId,
    },
  });

  return field;
};
