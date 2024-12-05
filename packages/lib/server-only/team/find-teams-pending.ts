import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';
import { Prisma } from '@documenso/prisma/client';
import { TeamPendingSchema } from '@documenso/prisma/generated/zod';

import { type FindResultSet, ZFindResultSet } from '../../types/find-result-set';

export interface FindTeamsPendingOptions {
  userId: number;
  term?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Team;
    direction: 'asc' | 'desc';
  };
}

export const ZFindTeamsPendingResponseSchema = ZFindResultSet.extend({
  data: TeamPendingSchema.array(),
});

export type TFindTeamsPendingResponse = z.infer<typeof ZFindTeamsPendingResponseSchema>;

export const findTeamsPending = async ({
  userId,
  term,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamsPendingOptions): Promise<TFindTeamsPendingResponse> => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.TeamPendingWhereInput = {
    ownerUserId: userId,
  };

  if (term && term.length > 0) {
    whereClause.name = {
      contains: term,
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
  } satisfies FindResultSet<typeof data>;
};
