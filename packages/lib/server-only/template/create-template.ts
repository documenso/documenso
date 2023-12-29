import { prisma } from '@documenso/prisma';
import { TCreateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type CreateTemplateOptions = TCreateTemplateMutationSchema & {
  userId: number;
};

export const createTemplate = async ({
  title,
  userId,
  templateDocumentDataId,
}: CreateTemplateOptions) => {
  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
    },
  });
};
