import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

import type { MonthlyStats } from './types';

type MonthlyDocumentGrowthQueryResult = Array<{
  month: Date;
  count: bigint;
  signed_count: bigint;
}>;

type MonthlyActiveUsersQueryResult = Array<{
  month: Date;
  count: bigint;
  cume_count: bigint;
}>;

export const getTeamMonthlyDocumentGrowth = async (teamId: number): Promise<MonthlyStats> => {
  const result = await prisma.$queryRaw<MonthlyDocumentGrowthQueryResult>`
      SELECT
        DATE_TRUNC('month', "Document"."createdAt") AS "month",
        COUNT(DISTINCT "Document"."id") as "count",
        COUNT(DISTINCT CASE WHEN "Document"."status" = 'COMPLETED' THEN "Document"."id" END) as "signed_count"
      FROM "Document"
      WHERE "Document"."teamId" = ${teamId}
        AND "Document"."deletedAt" IS NULL
      GROUP BY "month"
      ORDER BY "month" DESC
      LIMIT 12
    `;

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    signed_count: Number(row.signed_count),
  }));
};

export const getUserMonthlyDocumentGrowth = async (userId: number): Promise<MonthlyStats> => {
  const result = await prisma.$queryRaw<MonthlyDocumentGrowthQueryResult>`
      SELECT
        DATE_TRUNC('month', "Document"."createdAt") AS "month",
        COUNT(DISTINCT "Document"."id") as "count",
        COUNT(DISTINCT CASE WHEN "Document"."status" = 'COMPLETED' THEN "Document"."id" END) as "signed_count"
      FROM "Document"
      WHERE "Document"."userId" = ${userId}
        AND "Document"."deletedAt" IS NULL
      GROUP BY "month"
      ORDER BY "month" DESC
      LIMIT 12
    `;

  return result.map((row) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    signed_count: Number(row.signed_count),
  }));
};

export const getTeamMonthlyActiveUsers = async (teamId: number): Promise<MonthlyStats> => {
  const result = await prisma.$queryRaw<MonthlyActiveUsersQueryResult>`
      SELECT
        DATE_TRUNC('month', "Document"."createdAt") AS "month",
        COUNT(DISTINCT "Document"."userId") as "count",
        SUM(COUNT(DISTINCT "Document"."userId")) OVER (ORDER BY DATE_TRUNC('month', "Document"."createdAt")) as "cume_count"
      FROM "Document"
      WHERE "Document"."teamId" = ${teamId}
        AND "Document"."deletedAt" IS NULL
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
