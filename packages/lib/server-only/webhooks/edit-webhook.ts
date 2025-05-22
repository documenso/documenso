import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { buildTeamWhereQuery } from '../../utils/teams';

export type EditWebhookOptions = {
  id: string;
  data: Omit<Prisma.WebhookUpdateInput, 'id' | 'userId' | 'teamId'>;
  userId: number;
  teamId: number;
};

export const editWebhook = async ({ id, data, userId, teamId }: EditWebhookOptions) => {
  return await prisma.webhook.update({
    where: {
      id,
      team: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
    },
    data: {
      ...data,
    },
  });
};
