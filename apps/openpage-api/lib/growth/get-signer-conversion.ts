import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

import { addZeroMonth } from '../add-zero-month';

export const getSignerConversionMonthly = async (type: 'count' | 'cumulative' = 'count') => {
  const qb = kyselyPrisma.$kysely
    .selectFrom('Recipient')
    .innerJoin('User', 'Recipient.email', 'User.email')
    .select(({ fn }) => [
      fn<Date>('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']).as('month'),
      fn.count('Recipient.email').distinct().as('count'),
      fn
        .sum(fn.count('Recipient.email').distinct())
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) => ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']) as any))
        .as('cume_count'),
    ])
    .where('Recipient.signedAt', 'is not', null)
    .where('Recipient.signedAt', '<', (eb) => eb.ref('User.createdAt'))
    .groupBy(({ fn }) => fn('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']))
    .orderBy('month', 'desc');

  const result = await qb.execute();

  const transformedData = {
    labels: result.map((row) => DateTime.fromJSDate(row.month).toFormat('MMM yyyy')).reverse(),
    datasets: [
      {
        label: type === 'count' ? 'Signers That Signed Up' : 'Total Signers That Signed Up',
        data: result
          .map((row) => (type === 'count' ? Number(row.count) : Number(row.cume_count)))
          .reverse(),
      },
    ],
  };

  return addZeroMonth(transformedData);
};

export type GetSignerConversionMonthlyResult = Awaited<
  ReturnType<typeof getSignerConversionMonthly>
>;
