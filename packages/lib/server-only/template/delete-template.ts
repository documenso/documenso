import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type DeleteTemplateOptions = {
  id: number;
  userId: number;
  teamId: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  return await prisma.template.delete({
    where: {
      id,
      team: buildTeamWhereQuery(teamId, userId),
    },
  });
};
