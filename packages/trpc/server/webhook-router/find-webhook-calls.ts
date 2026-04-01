import { Prisma, WebhookCallStatus, WebhookTriggerEvents } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindWebhookCallsRequestSchema,
  ZFindWebhookCallsResponseSchema,
} from './find-webhook-calls.types';

export const findWebhookCallsRoute = authenticatedProcedure
  .input(ZFindWebhookCallsRequestSchema)
  .output(ZFindWebhookCallsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { webhookId, page, perPage, status, query, events } = input;

    ctx.logger.info({
      input: { webhookId, status },
    });

    return await findWebhookCalls({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      webhookId,
      page,
      perPage,
      status,
      query,
      events,
    });
  });

type FindWebhookCallsOptions = {
  userId: number;
  teamId: number;
  webhookId: string;
  page?: number;
  perPage?: number;
  status?: WebhookCallStatus;
  events?: WebhookTriggerEvents[];
  query?: string;
};

export const findWebhookCalls = async ({
  userId,
  teamId,
  webhookId,
  page = 1,
  perPage = 20,
  events,
  query = '',
  status,
}: FindWebhookCallsOptions) => {
  const webhook = await prisma.webhook.findFirst({
    where: {
      id: webhookId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM,
      }),
    },
  });

  if (!webhook) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.WebhookCallWhereInput = {
    webhookId: webhook.id,
    status,
    id: query || undefined,
    event:
      events && events.length > 0
        ? {
            in: events,
          }
        : undefined,
  };

  const [data, count] = await Promise.all([
    prisma.webhookCall.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.webhookCall.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
