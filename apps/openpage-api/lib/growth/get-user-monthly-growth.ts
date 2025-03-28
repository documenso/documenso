import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

import { addZeroMonth } from '../add-zero-month';

export const getUserMonthlyGrowth = async (type: 'count' | 'cumulative' = 'count') => {
  const qb = kyselyPrisma.$kysely
    .selectFrom('User')
    .select(({ fn }) => [
      fn<Date>('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']).as('month'),
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) => ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']) as any))
        .as('cume_count'),
    ])
    .groupBy('month')
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  const transformedData = {
    labels: result.map((row) => DateTime.fromJSDate(row.month).toFormat('MMM yyyy')).reverse(),
    datasets: [
      {
        label: type === 'count' ? 'New Users' : 'Total Users',
        data: result
          .map((row) => (type === 'count' ? Number(row.count) : Number(row.cume_count)))
          .reverse(),
      },
    ],
  };

  return addZeroMonth(transformedData);
};

export type GetUserMonthlyGrowthResult = Awaited<ReturnType<typeof getUserMonthlyGrowth>>;
