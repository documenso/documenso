import { TRPCError } from '@trpc/server';

import { prisma } from '@documenso/prisma';

export type MoveTemplateToTeamOptions = {
  templateId: number;
  teamId: number;
  userId: number;
};

export const moveTemplateToTeam = async ({
  templateId,
  teamId,
  userId,
}: MoveTemplateToTeamOptions) => {
  return await prisma.$transaction(async (tx) => {
    const template = await tx.template.findFirst({
      where: {
        id: templateId,
        userId,
        teamId: null,
      },
    });

    if (!template) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found or already associated with a team.',
      });
    }

    const team = await tx.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });

    if (!team) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this team.',
      });
    }

    const updatedTemplate = await tx.template.update({
      where: { id: templateId },
      data: { teamId },
    });

    return updatedTemplate;
  });
};
