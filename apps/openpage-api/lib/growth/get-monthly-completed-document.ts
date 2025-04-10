import { DocumentStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

import { addZeroMonth } from '../add-zero-month';

export const getCompletedDocumentsMonthly = async (type: 'count' | 'cumulative' = 'count') => {
  const qb = kyselyPrisma.$kysely
    .selectFrom('Document')
    .select(({ fn }) => [
      fn<Date>('DATE_TRUNC', [sql.lit('MONTH'), 'Document.updatedAt']).as('month'),
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // Feels like a bug in the Kysely extension but I just can not do this orderBy in a type-safe manner
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) => ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), 'Document.updatedAt']) as any))
        .as('cume_count'),
    ])
    .where(() => sql`"Document"."status" = ${DocumentStatus.COMPLETED}::"DocumentStatus"`)
    .groupBy('month')
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  const transformedData = {
    labels: result.map((row) => DateTime.fromJSDate(row.month).toFormat('MMM yyyy')).reverse(),
    datasets: [
      {
        label: type === 'count' ? 'Completed Documents per Month' : 'Total Completed Documents',
        data: result
          .map((row) => (type === 'count' ? Number(row.count) : Number(row.cume_count)))
          .reverse(),
      },
    ],
  };

  return addZeroMonth(transformedData);
};

export type GetCompletedDocumentsMonthlyResult = Awaited<
  ReturnType<typeof getCompletedDocumentsMonthly>
>;
