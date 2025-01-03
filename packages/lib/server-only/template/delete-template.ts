'use server';

import { prisma } from '@documenso/prisma';

export type DeleteTemplateOptions = {
  id: number;
  userId: string;
  teamId?: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  return await prisma.template.delete({
    where: {
      id,
      OR:
        teamId === undefined
          ? [
              {
                userId,
                teamId: null,
              },
            ]
          : [
              {
                teamId,
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
