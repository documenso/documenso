import { DateTime } from 'luxon';

import { SQL, prisma } from '@documenso/prisma';

export const getUserMonthlyGrowth = async () => {
  const result = await prisma.$queryRawTyped(SQL.userMonthlyGrowth());

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};

export type GetUserMonthlyGrowthResult = Awaited<ReturnType<typeof getUserMonthlyGrowth>>;
