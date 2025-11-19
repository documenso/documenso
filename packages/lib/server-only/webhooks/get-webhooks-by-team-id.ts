import { prisma } from '@doku-seal/prisma';

export const getWebhooksByTeamId = async (teamId: number, userId: number) => {
  return await prisma.webhook.findMany({
    where: {
      team: {
        id: teamId,
        teamGroups: {
          some: {
            organisationGroup: {
              organisationGroupMembers: {
                some: {
                  organisationMember: {
                    userId,
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
