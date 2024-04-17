import { prisma } from '@documenso/prisma';
import type { TCreateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type CreateTemplateOptions = TCreateTemplateMutationSchema & {
  userId: number;
  teamId?: number;
};

export const createTemplate = async ({
  title,
  userId,
  teamId,
  templateDocumentDataId,
}: CreateTemplateOptions) => {
  if (teamId) {
    await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
      teamId,
    },
  });
};
