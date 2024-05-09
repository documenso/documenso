import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

export type GetSignerConversionQueryResult = Array<{
  count: number;
}>;

export type GetSignerConversionMonthlyResult = Array<{
  month: string;
  count: number;
  cume_count: number;
}>;

type GetSignerConversionMonthlyQueryResult = Array<{
  month: Date;
  count: number;
  cume_count: number;
}>;

export const getSignerConversion = async () => {
  const result = await prisma.$queryRaw<GetSignerConversionQueryResult>`
    SELECT
      COUNT(DISTINCT "Recipient"."email")::integer as "count"
    FROM
      "Recipient"
      INNER JOIN "User" ON "Recipient"."email" = "User"."email"
    WHERE
      "Recipient"."signedAt" IS NOT NULL
      AND "Recipient"."signedAt" < "User"."createdAt";
  `;

  return {
    count: Number(result[0].count),
  };
};

export const getSignerConversionMonthly = async () => {
  const result = await prisma.$queryRaw<GetSignerConversionMonthlyQueryResult>`
    SELECT
      DATE_TRUNC('month', "User"."createdAt")::date AS "month",
      COUNT(DISTINCT "Recipient"."email")::integer AS "count",
      SUM(COUNT(DISTINCT "Recipient"."email")) OVER (ORDER BY DATE_TRUNC('month', "User"."createdAt"))::integer AS "cume_count"
    FROM
      "Recipient"
      INNER JOIN "User" ON "Recipient"."email" = "User"."email"
    WHERE
      "Recipient"."signedAt" IS NOT NULL
      AND "Recipient"."signedAt" < "User"."createdAt"
    GROUP BY DATE_TRUNC('month', "User"."createdAt")
    ORDER BY "month" DESC;
  `;

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};
