import { prisma } from '@documenso/prisma';
import type { DocumentVisibility } from '@documenso/prisma/client';

export type UpdatePublicProfileOptions = {
  userId: number;
  teamId: number;
  data: {
    documentVisibility?: DocumentVisibility;
    includeSenderDetails?: boolean;
  };
};

export const updateTeamDocumentsGlobalSettings = async ({
  userId,
  teamId,
  data,
}: UpdatePublicProfileOptions) => {
  return await prisma.team.update({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
        },
      },
    },
    data: {
      teamGlobalSettings: {
        upsert: {
          create: data,
          update: data,
        },
      },
    },
    include: {
      teamGlobalSettings: true,
    },
  });
};
