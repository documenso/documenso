import { prisma } from '@documenso/prisma';

export type GetSignerConversionQueryResult = Array<{
  count: number;
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
