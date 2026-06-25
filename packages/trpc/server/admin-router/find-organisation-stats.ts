import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { kyselyPrisma, sql } from '@documenso/prisma';
import { match } from 'ts-pattern';

import { adminProcedure } from '../trpc';
import {
  ZFindOrganisationStatsRequestSchema,
  ZFindOrganisationStatsResponseSchema,
} from './find-organisation-stats.types';

export const findOrganisationStatsRoute = adminProcedure
  .input(ZFindOrganisationStatsRequestSchema)
  .output(ZFindOrganisationStatsResponseSchema)
  .query(async ({ input }) => {
    const { query, period, claimId, page, perPage, orderByColumn, orderByDirection } = input;

    return await findOrganisationStats({
      query,
      period,
      claimId,
      page,
      perPage,
      orderByColumn,
      orderByDirection,
    });
  });

type FindOrganisationStatsOptions = {
  query?: string;
  period?: string;
  claimId?: string;
  page?: number;
  perPage?: number;
  orderByColumn?: 'documentCount' | 'emailCount' | 'apiCount' | 'emailReports' | 'totalCount';
  orderByDirection?: 'asc' | 'desc';
};

export const findOrganisationStats = async ({
  query,
  period,
  claimId,
  page = 1,
  perPage = 10,
  orderByColumn,
  orderByDirection = 'desc',
}: FindOrganisationStatsOptions) => {
  const offset = Math.max(page - 1, 0) * perPage;

  // Stats are always scoped to a single month. Default to the current month when none is given.
  const resolvedPeriod = period ?? currentMonthlyPeriod();

  const totalCountExpression = sql<number>`(
    "OrganisationMonthlyStat"."documentCount"
    + "OrganisationMonthlyStat"."emailCount"
    + "OrganisationMonthlyStat"."apiCount"
  )`;

  let baseQuery = kyselyPrisma.$kysely
    .selectFrom('OrganisationMonthlyStat')
    .innerJoin('Organisation', 'Organisation.id', 'OrganisationMonthlyStat.organisationId')
    .leftJoin('OrganisationClaim', 'OrganisationClaim.id', 'Organisation.organisationClaimId')
    .where('OrganisationMonthlyStat.period', '=', resolvedPeriod);

  if (query) {
    // Organisation IDs are prefixed with `org_`. When the query uses that prefix it is
    // unambiguously an ID (or URL) lookup, so use indexed equality matches instead of
    // scanning every column with `ILIKE`.
    if (query.startsWith('org_')) {
      baseQuery = baseQuery.where((eb) =>
        eb.or([eb('Organisation.id', '=', query), eb('Organisation.url', '=', query)]),
      );
    } else {
      baseQuery = baseQuery.where((eb) =>
        eb.or([eb('Organisation.name', 'ilike', `%${query}%`), eb('Organisation.url', 'ilike', `%${query}%`)]),
      );
    }
  }

  if (claimId) {
    baseQuery = baseQuery.where('OrganisationClaim.originalSubscriptionClaimId', '=', claimId);
  }

  const dataQuery = baseQuery
    .select((eb) => [
      'OrganisationMonthlyStat.id as id',
      'OrganisationMonthlyStat.organisationId as organisationId',
      'Organisation.name as organisationName',
      'OrganisationClaim.originalSubscriptionClaimId as originalClaimId',
      'OrganisationMonthlyStat.period as period',
      'OrganisationMonthlyStat.documentCount as documentCount',
      'OrganisationMonthlyStat.emailCount as emailCount',
      'OrganisationMonthlyStat.apiCount as apiCount',
      'OrganisationMonthlyStat.emailReports as emailReports',
      'OrganisationClaim.documentQuota as documentQuota',
      'OrganisationClaim.emailQuota as emailQuota',
      'OrganisationClaim.apiQuota as apiQuota',
      totalCountExpression.as('totalCount'),
      eb.fn.countAll().over().as('totalRows'),
    ])
    .$call((qb) =>
      match(orderByColumn)
        .with('documentCount', () => qb.orderBy('OrganisationMonthlyStat.documentCount', orderByDirection))
        .with('emailCount', () => qb.orderBy('OrganisationMonthlyStat.emailCount', orderByDirection))
        .with('apiCount', () => qb.orderBy('OrganisationMonthlyStat.apiCount', orderByDirection))
        .with('emailReports', () => qb.orderBy('OrganisationMonthlyStat.emailReports', orderByDirection))
        .with('totalCount', () => qb.orderBy(totalCountExpression, orderByDirection))
        .with(undefined, () =>
          // Default ordering mirrors the desired SQL: email, api, document descending.
          qb
            .orderBy('OrganisationMonthlyStat.emailCount', 'desc')
            .orderBy('OrganisationMonthlyStat.apiCount', 'desc')
            .orderBy('OrganisationMonthlyStat.documentCount', 'desc'),
        )
        .exhaustive(),
    )
    .orderBy('OrganisationMonthlyStat.id', 'asc')
    .limit(perPage)
    .offset(offset);

  const rows = await dataQuery.execute();

  const count = rows.length > 0 ? Number(rows[0].totalRows) : 0;

  const data = rows.map((row) => ({
    id: row.id,
    organisationId: row.organisationId,
    organisationName: row.organisationName,
    originalClaimId: row.originalClaimId,
    period: row.period,
    documentCount: Number(row.documentCount),
    emailCount: Number(row.emailCount),
    apiCount: Number(row.apiCount),
    emailReports: Number(row.emailReports),
    documentQuota: row.documentQuota === null ? null : Number(row.documentQuota),
    emailQuota: row.emailQuota === null ? null : Number(row.emailQuota),
    apiQuota: row.apiQuota === null ? null : Number(row.apiQuota),
    totalCount: Number(row.totalCount),
  }));

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
