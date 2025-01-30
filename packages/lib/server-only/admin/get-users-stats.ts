import { DateTime } from 'luxon';

import { kyselyPrisma, prisma, sql } from '@documenso/prisma';
import {
  DocumentStatus,
  SubscriptionStatus,
  UserSecurityAuditLogType,
} from '@documenso/prisma/client';

export const getUsersCount = async () => {
  return await prisma.user.count();
};

export const getUsersWithSubscriptionsCount = async () => {
  return await prisma.user.count({
    where: {
      subscriptions: {
        some: {
          status: SubscriptionStatus.ACTIVE,
        },
      },
    },
  });
};

export const getUserWithAtLeastOneDocumentPerMonth = async () => {
  return await prisma.user.count({
    where: {
      documents: {
        some: {
          createdAt: {
            gte: DateTime.now().minus({ months: 1 }).toJSDate(),
          },
        },
      },
    },
  });
};

export const getUserWithAtLeastOneDocumentSignedPerMonth = async () => {
  return await prisma.user.count({
    where: {
      documents: {
        some: {
          status: {
            equals: DocumentStatus.COMPLETED,
          },
          completedAt: {
            gte: DateTime.now().minus({ months: 1 }).toJSDate(),
          },
        },
      },
    },
  });
};

export type GetUserWithDocumentMonthlyGrowth = Array<{
  month: string;
  count: number;
  signed_count: number;
}>;

type GetUserWithDocumentMonthlyGrowthQueryResult = Array<{
  month: Date;
  count: bigint;
  signed_count: bigint;
}>;

export const getUserWithSignedDocumentMonthlyGrowth = async () => {
  const result = await prisma.$queryRaw<GetUserWithDocumentMonthlyGrowthQueryResult>`
      SELECT
        DATE_TRUNC('month', "Document"."createdAt") AS "month",
        COUNT(DISTINCT "Document"."userId") as "count",
        COUNT(DISTINCT CASE WHEN "Document"."status" = 'COMPLETED' THEN "Document"."userId" END) as "signed_count"
      FROM "Document"
      GROUP BY "month"
      ORDER BY "month" DESC
      LIMIT 12
`;

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    signed_count: Number(row.signed_count),
  }));
};

export type GetMonthlyActiveUsersResult = Array<{
  month: string;
  count: number;
  cume_count: number;
}>;

export const getMonthlyActiveUsers = async () => {
  const qb = kyselyPrisma.$kysely
    .selectFrom('UserSecurityAuditLog')
    .select(({ fn }) => [
      fn<Date>('DATE_TRUNC', [sql.lit('MONTH'), 'UserSecurityAuditLog.createdAt']).as('month'),
      fn.count('userId').distinct().as('count'),
      fn
        .sum(fn.count('userId').distinct())
        .over((ob) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), 'UserSecurityAuditLog.createdAt']) as any),
        )
        .as('cume_count'),
    ])
    // @ts-expect-error - Raw SQL enum casting not properly typed by Kysely
    .where(sql`type = ${UserSecurityAuditLogType.SIGN_IN}::"UserSecurityAuditLogType"`)
    .groupBy(({ fn }) => fn('DATE_TRUNC', [sql.lit('MONTH'), 'UserSecurityAuditLog.createdAt']))
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};
