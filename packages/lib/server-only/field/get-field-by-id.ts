import { prisma } from '@documenso/prisma';

export type GetFieldByIdOptions = {
  fieldId: number;
  documentId?: number;
  templateId?: number;
};

export const getFieldById = async ({ fieldId, documentId, templateId }: GetFieldByIdOptions) => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      ...(documentId ? { documentId } : {}),
      ...(templateId ? { templateId } : {}),
    },
  });

  return field;
};
