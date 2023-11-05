import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

export type GetUserMonthlyGrowthResult = Array<{
  month: string;
  count: number;
}>;

type GetUserMonthlyGrowthQueryResult = Array<{
  month: Date;
  count: bigint;
}>;

export const getUserMonthlyGrowth = async () => {
  const result = await prisma.$queryRaw<GetUserMonthlyGrowthQueryResult>`
    SELECT
      DATE_TRUNC('month', "createdAt") AS "month",
      COUNT("id") AS "count"
    FROM "User"
    GROUP BY "month"
    ORDER BY "month" DESC
    LIMIT 12
  `;

  console.log('result', result);

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
  }));
};
