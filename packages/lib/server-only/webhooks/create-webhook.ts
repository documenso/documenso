import type { WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export interface CreateWebhookOptions {
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: boolean;
  userId: number;
  teamId: number;
}

export const createWebhook = async ({
  webhookUrl,
  eventTriggers,
  secret,
  enabled,
  userId,
  teamId,
}: CreateWebhookOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  return await prisma.webhook.create({
    data: {
      webhookUrl,
      eventTriggers,
      secret,
      enabled,
      userId,
      teamId,
    },
  });
};
