import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetWebhookByIdOptions = {
  id: string;
  userId: number;
  teamId: number;
};

export const getWebhookById = async ({ id, userId, teamId }: GetWebhookByIdOptions) => {
  return await prisma.webhook.findFirstOrThrow({
    where: {
      id,
      team: buildTeamWhereQuery({
        teamId,
        userId,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM,
      }),
    },
  });
};
