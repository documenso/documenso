import { DocumentStatus } from '@prisma/client';

import type { DateRange } from '@documenso/lib/types/search-params';
import { kyselyPrisma, sql } from '@documenso/prisma';

export type OrganisationInsights = {
  id: number;
  name: string;
  signingVolume: number;
  createdAt: Date;
  customerId: string | null;
  subscriptionStatus?: string;
  teamCount?: number;
  memberCount?: number;
};

export type GetSigningVolumeOptions = {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'createdAt' | 'signingVolume';
  sortOrder?: 'asc' | 'desc';
};

export async function getSigningVolume({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
}: GetSigningVolumeOptions) {
  const offset = Math.max(page - 1, 0) * perPage;

  let findQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .leftJoin('Document as d', (join) =>
      join
        .onRef('t.id', '=', 'd.teamId')
        .on('d.status', '=', sql.lit(DocumentStatus.COMPLETED))
        .on('d.deletedAt', 'is', null),
    )
    .where((eb) =>
      eb.or([eb('o.name', 'ilike', `%${search}%`), eb('t.name', 'ilike', `%${search}%`)]),
    )
    .select([
      'o.id as id',
      'o.createdAt as createdAt',
      'o.customerId as customerId',
      sql<string>`COALESCE(o.name, 'Unknown')`.as('name'),
      sql<number>`COUNT(DISTINCT d.id)`.as('signingVolume'),
    ])
    .groupBy(['o.id', 'o.name', 'o.customerId']);

  switch (sortBy) {
    case 'name':
      findQuery = findQuery.orderBy('name', sortOrder);
      break;
    case 'createdAt':
      findQuery = findQuery.orderBy('createdAt', sortOrder);
      break;
    case 'signingVolume':
      findQuery = findQuery.orderBy('signingVolume', sortOrder);
      break;
    default:
      findQuery = findQuery.orderBy('signingVolume', 'desc');
  }

  findQuery = findQuery.limit(perPage).offset(offset);

  const countQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .where((eb) =>
      eb.or([eb('o.name', 'ilike', `%${search}%`), eb('t.name', 'ilike', `%${search}%`)]),
    )
    .select(() => [sql<number>`COUNT(DISTINCT o.id)`.as('count')]);

  const [results, [{ count }]] = await Promise.all([findQuery.execute(), countQuery.execute()]);

  return {
    organisations: results,
    totalPages: Math.ceil(Number(count) / perPage),
  };
}

export type GetOrganisationInsightsOptions = GetSigningVolumeOptions & {
  dateRange?: DateRange;
  startDate?: Date;
  endDate?: Date;
};

export async function getOrganisationInsights({
  search = '',
  page = 1,
  perPage = 10,
  sortBy = 'signingVolume',
  sortOrder = 'desc',
  dateRange = 'last30days',
  startDate,
  endDate,
}: GetOrganisationInsightsOptions) {
  const offset = Math.max(page - 1, 0) * perPage;

  const now = new Date();
  let dateCondition = sql`1=1`;

  if (startDate && endDate) {
    dateCondition = sql`d."createdAt" >= ${startDate} AND d."createdAt" <= ${endDate}`;
  } else {
    switch (dateRange) {
      case 'last30days': {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateCondition = sql`d."createdAt" >= ${thirtyDaysAgo}`;
        break;
      }
      case 'last90days': {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateCondition = sql`d."createdAt" >= ${ninetyDaysAgo}`;
        break;
      }
      case 'lastYear': {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        dateCondition = sql`d."createdAt" >= ${oneYearAgo}`;
        break;
      }
      case 'allTime':
      default:
        dateCondition = sql`1=1`;
        break;
    }
  }

  let findQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .leftJoin('Document as d', (join) =>
      join
        .onRef('t.id', '=', 'd.teamId')
        .on('d.status', '=', sql.lit(DocumentStatus.COMPLETED))
        .on('d.deletedAt', 'is', null),
    )
    .leftJoin('OrganisationMember as om', 'o.id', 'om.organisationId')
    .leftJoin('Subscription as s', 'o.id', 's.organisationId')
    .where((eb) =>
      eb.or([eb('o.name', 'ilike', `%${search}%`), eb('t.name', 'ilike', `%${search}%`)]),
    )
    .select([
      'o.id as id',
      'o.createdAt as createdAt',
      'o.customerId as customerId',
      sql<string>`COALESCE(o.name, 'Unknown')`.as('name'),
      sql<number>`COUNT(DISTINCT CASE WHEN d.id IS NOT NULL AND ${dateCondition} THEN d.id END)`.as(
        'signingVolume',
      ),
      sql<number>`GREATEST(COUNT(DISTINCT t.id), 1)`.as('teamCount'),
      sql<number>`COUNT(DISTINCT om."userId")`.as('memberCount'),
      sql<string>`CASE WHEN s.status IS NOT NULL THEN s.status ELSE NULL END`.as(
        'subscriptionStatus',
      ),
    ])
    .groupBy(['o.id', 'o.name', 'o.customerId', 's.status']);

  switch (sortBy) {
    case 'name':
      findQuery = findQuery.orderBy('name', sortOrder);
      break;
    case 'createdAt':
      findQuery = findQuery.orderBy('createdAt', sortOrder);
      break;
    case 'signingVolume':
      findQuery = findQuery.orderBy('signingVolume', sortOrder);
      break;
    default:
      findQuery = findQuery.orderBy('signingVolume', 'desc');
  }

  findQuery = findQuery.limit(perPage).offset(offset);

  const countQuery = kyselyPrisma.$kysely
    .selectFrom('Organisation as o')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .where((eb) =>
      eb.or([eb('o.name', 'ilike', `%${search}%`), eb('t.name', 'ilike', `%${search}%`)]),
    )
    .select(() => [sql<number>`COUNT(DISTINCT o.id)`.as('count')]);

  const [results, [{ count }]] = await Promise.all([findQuery.execute(), countQuery.execute()]);

  return {
    organisations: results,
    totalPages: Math.ceil(Number(count) / perPage),
  };
}
