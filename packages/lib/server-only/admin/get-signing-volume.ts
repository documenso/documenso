import { DocumentStatus, SubscriptionStatus } from '@prisma/client';

import { kyselyPrisma, sql } from '@documenso/prisma';

export type SigningVolume = {
  id: number;
  name: string;
  signingVolume: number;
  createdAt: Date;
  planId: string;
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
    .selectFrom('Subscription as s')
    .innerJoin('Organisation as o', 's.organisationId', 'o.id')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .leftJoin('Document as d', (join) =>
      join
        .onRef('t.id', '=', 'd.teamId')
        .on('d.status', '=', sql.lit(DocumentStatus.COMPLETED))
        .on('d.deletedAt', 'is', null),
    )
    .where(sql`s.status = ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus"`)
    .where((eb) =>
      eb.or([eb('o.name', 'ilike', `%${search}%`), eb('t.name', 'ilike', `%${search}%`)]),
    )
    .select([
      's.id as id',
      's.createdAt as createdAt',
      's.planId as planId',
      sql<string>`COALESCE(o.name, 'Unknown')`.as('name'),
      sql<number>`COUNT(DISTINCT d.id)`.as('signingVolume'),
    ])
    .groupBy(['s.id', 'o.name']);

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
    .selectFrom('Subscription as s')
    .innerJoin('Organisation as o', 's.organisationId', 'o.id')
    .leftJoin('Team as t', 'o.id', 't.organisationId')
    .where(sql`s.status = ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus"`)
    .where((eb) =>
      eb.or([eb('o.name', 'ilike', `%${search}%`), eb('t.name', 'ilike', `%${search}%`)]),
    )
    .select(({ fn }) => [fn.countAll().as('count')]);

  const [results, [{ count }]] = await Promise.all([findQuery.execute(), countQuery.execute()]);

  return {
    leaderboard: results,
    totalPages: Math.ceil(Number(count) / perPage),
  };
}
