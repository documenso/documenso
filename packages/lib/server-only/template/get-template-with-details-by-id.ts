import { prisma } from '@documenso/prisma';
import type { TemplateWithDetails } from '@documenso/prisma/types/template';

export type GetTemplateWithDetailsByIdOptions = {
  id: number;
  userId: number;
};

export const getTemplateWithDetailsById = async ({
  id,
  userId,
}: GetTemplateWithDetailsByIdOptions): Promise<TemplateWithDetails> => {
  return await prisma.template.findFirstOrThrow({
    where: {
      id,
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
    include: {
      directLink: true,
      templateDocumentData: true,
      templateMeta: true,
      Recipient: true,
      Field: true,
    },
  });
};
