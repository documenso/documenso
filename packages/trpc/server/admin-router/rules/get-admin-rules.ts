import { prisma } from '@documenso/prisma';
import type { AdminRule } from '@prisma/client';
import { DateTime } from 'luxon';
import pMap from 'p-map';

import { adminProcedure } from '../../trpc';
import { ZGetAdminRulesRequestSchema, ZGetAdminRulesResponseSchema } from './get-admin-rules.types';

export const getAdminRulesRoute = adminProcedure
  .input(ZGetAdminRulesRequestSchema)
  .output(ZGetAdminRulesResponseSchema)
  .query(async () => {
    const rules = await prisma.adminRule.findMany({
      // The order the engine runs rules in. Rules created at the same moment can share a priority,
      // so ties go to the older rule.
      orderBy: [
        {
          priority: 'asc',
        },
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return await getAdminRuleListItems(rules);
  });

/**
 * Adds what the rules list and the rule page show alongside each rule: its matches in the last 7
 * days, its newest match, and the exempt organisations that still exist.
 */
export const getAdminRuleListItems = async (rules: AdminRule[]) => {
  const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toJSDate();

  const exemptOrganisationIds = Array.from(new Set(rules.flatMap((rule) => rule.exemptOrganisationIds)));

  const [recentMatchCounts, lastMatches, exemptOrganisations] = await Promise.all([
    prisma.adminRuleMatch.groupBy({
      by: ['ruleId'],
      where: {
        ruleId: {
          in: rules.map((rule) => rule.id),
        },
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: {
        _all: true,
      },
    }),
    // Each rule's newest match is a single read from the (ruleId, createdAt) index. A grouped max
    // over the whole table would read every stored match on every load. Ten at a time, so a long
    // rule list can't tie up the connection pool.
    pMap(
      rules,
      async (rule) =>
        await prisma.adminRuleMatch.findFirst({
          where: {
            ruleId: rule.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        }),
      {
        concurrency: 10,
      },
    ),
    prisma.organisation.findMany({
      where: {
        id: {
          in: exemptOrganisationIds,
        },
      },
      select: {
        id: true,
        name: true,
        url: true,
      },
    }),
  ]);

  return rules.map((rule, index) => ({
    ...rule,
    matchCountLast7Days: recentMatchCounts.find((count) => count.ruleId === rule.id)?._count._all ?? 0,
    lastMatchedAt: lastMatches[index]?.createdAt ?? null,
    exemptOrganisations: exemptOrganisations.filter((organisation) =>
      rule.exemptOrganisationIds.includes(organisation.id),
    ),
  }));
};
