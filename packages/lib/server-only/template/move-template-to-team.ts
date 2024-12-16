import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TemplateSchema } from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type MoveTemplateToTeamOptions = {
  templateId: number;
  teamId: number;
  userId: number;
};

export const ZMoveTemplateToTeamResponseSchema = TemplateSchema;

export type TMoveTemplateToTeamResponse = z.infer<typeof ZMoveTemplateToTeamResponseSchema>;

export const moveTemplateToTeam = async ({
  templateId,
  teamId,
  userId,
}: MoveTemplateToTeamOptions): Promise<TMoveTemplateToTeamResponse> => {
  return await prisma.$transaction(async (tx) => {
    const template = await tx.template.findFirst({
      where: {
        id: templateId,
        userId,
        teamId: null,
      },
    });

    if (!template) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
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
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Team does not exist or you are not a member of this team.',
      });
    }

    const updatedTemplate = await tx.template.update({
      where: { id: templateId },
      data: { teamId },
    });

    return updatedTemplate;
  });
};
