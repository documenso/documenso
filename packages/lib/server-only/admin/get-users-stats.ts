import { DocumentStatus, SubscriptionStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

export const getUsersCount = async () => {
  return await prisma.user.count();
};

export const getOrganisationsWithSubscriptionsCount = async () => {
  return await prisma.organisation.count({
    where: {
      subscription: {
        status: SubscriptionStatus.ACTIVE,
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
