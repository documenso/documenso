import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { adminProcedure } from '../../trpc';
import {
  type TAdminRuleMatchPeriod,
  ZFindAdminRuleMatchesRequestSchema,
  ZFindAdminRuleMatchesResponseSchema,
} from './find-admin-rule-matches.types';

export const findAdminRuleMatchesRoute = adminProcedure
  .input(ZFindAdminRuleMatchesRequestSchema)
  .output(ZFindAdminRuleMatchesResponseSchema)
  .query(async ({ input }) => {
    const { ruleId, trigger, mode, period, blockedOnly, query, page = 1, perPage = 20 } = input;

    const whereClause: Prisma.AdminRuleMatchWhereInput = {
      ruleId,
      trigger,
      mode,
    };

    if (period) {
      whereClause.createdAt = {
        gte: getPeriodStart(period),
      };
    }

    if (query) {
      whereClause.OR = [
        {
          actorUser: {
            email: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          actorUser: {
            name: {
              contains: query,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ];
    }

    // A block is a match whose block_event action ran. Only enforced rules run actions, so this
    // already excludes monitor matches, and it narrows the mode filter rather than replacing it.
    if (blockedOnly) {
      whereClause.actionsRun = {
        array_contains: [
          {
            type: 'block_event',
            status: 'ran',
          },
        ],
      };
    }

    const [data, count] = await Promise.all([
      prisma.adminRuleMatch.findMany({
        where: whereClause,
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
        // Leaves out the event snapshot, which holds personal data the list never shows.
        select: {
          id: true,
          createdAt: true,
          mode: true,
          trigger: true,
          actionsRun: true,
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
          actorUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.adminRuleMatch.count({
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
  });

const getPeriodStart = (period: TAdminRuleMatchPeriod) =>
  match(period)
    .with('24h', () => DateTime.now().minus({ hours: 24 }))
    .with('7d', () => DateTime.now().minus({ days: 7 }))
    .with('30d', () => DateTime.now().minus({ days: 30 }))
    .exhaustive()
    .toJSDate();
