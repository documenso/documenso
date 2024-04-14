import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

export type GetCompletedDocumentsMonthlyResult = Array<{
  month: string;
  count: number;
  cume_count: number;
}>;

type GetCompletedDocumentsMonthlyQueryResult = Array<{
  month: Date;
  count: bigint;
  cume_count: bigint;
}>;

export const getCompletedDocumentsMonthly = async () => {
  const result = await prisma.$queryRaw<GetCompletedDocumentsMonthlyQueryResult>`
    SELECT
      DATE_TRUNC('month', "updatedAt") AS "month",
      COUNT("id") as "count",
      SUM(COUNT("id")) OVER (ORDER BY DATE_TRUNC('month', "updatedAt")) as "cume_count"
    FROM "Document"
    WHERE "status" = 'COMPLETED'
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
