'use server';

import { prisma } from '@documenso/prisma';

export type DeleteTemplateOptions = {
  id: number;
  userId: number;
};

export const deleteTemplate = async ({ id, userId }: DeleteTemplateOptions) => {
  return await prisma.template.delete({
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
  });
};
