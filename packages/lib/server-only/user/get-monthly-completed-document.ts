import { sql } from 'kysely';
import { DateTime } from 'luxon';

import { kyselyPrisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export type GetCompletedDocumentsMonthlyResult = Array<{
  month: string;
  count: number;
  cume_count: number;
}>;

export const getCompletedDocumentsMonthly = async () => {
  const qb = kyselyPrisma.$kysely
    .selectFrom('Document')
    .select(({ fn, ref }) => [
      fn<Date>('DATE_TRUNC', [sql.lit('MONTH'), ref('Document.updatedAt')]).as('month'),
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // Feels like a bug in the Kysely extension but I just can not do this orderBy in a type-safe manner
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob) =>
          ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), ref('Document.updatedAt')]) as any),
        )
        .as('cume_count'),
    ])
    .where(() => sql`"Document"."status" = ${DocumentStatus.COMPLETED}::"DocumentStatus"`)
    .groupBy('month')
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};
