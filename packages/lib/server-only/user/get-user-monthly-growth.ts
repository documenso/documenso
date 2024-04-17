import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

export type GetUserMonthlyGrowthResult = Array<{
  month: string;
  count: number;
  cume_count: number;
}>;

type GetUserMonthlyGrowthQueryResult = Array<{
  month: Date;
  count: bigint;
  cume_count: bigint;
}>;

export const getUserMonthlyGrowth = async () => {
  const result = await prisma.$queryRaw<GetUserMonthlyGrowthQueryResult>`
    SELECT
      DATE_TRUNC('month', "createdAt") AS "month",
      COUNT("id") as "count",
      SUM(COUNT("id")) OVER (ORDER BY DATE_TRUNC('month', "createdAt")) as "cume_count"
    FROM "User"
    GROUP BY "month"
    ORDER BY "month" DESC
    LIMIT 12
  `;

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};
