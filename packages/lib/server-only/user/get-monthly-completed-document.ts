import { DateTime } from 'luxon';

import { SQL, prisma } from '@documenso/prisma';

export const getCompletedDocumentsMonthly = async () => {
  const result = await prisma.$queryRawTyped(SQL.completedDocumentsMonthly());

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};

export type GetCompletedDocumentsMonthlyResult = Awaited<
  ReturnType<typeof getCompletedDocumentsMonthly>
>;
