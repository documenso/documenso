import type { Team } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TeamPendingSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamPendingSchema';

import { type FindResultResponse, ZFindResultResponse } from '../../types/search-params';

export interface FindTeamsPendingOptions {
  userId: number;
  query?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Team;
    direction: 'asc' | 'desc';
  };
}

export const ZFindTeamsPendingResponseSchema = ZFindResultResponse.extend({
  data: TeamPendingSchema.array(),
});

export type TFindTeamsPendingResponse = z.infer<typeof ZFindTeamsPendingResponseSchema>;

export const findTeamsPending = async ({
  userId,
  query,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamsPendingOptions): Promise<TFindTeamsPendingResponse> => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.TeamPendingWhereInput = {
    ownerUserId: userId,
  };

  if (query && query.length > 0) {
    whereClause.name = {
      contains: query,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.teamPending.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
    }),
    prisma.teamPending.count({
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
