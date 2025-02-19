import { kyselyPrisma, sql } from '@documenso/prisma';
import { DocumentStatus, SubscriptionStatus } from '@documenso/prisma/client';

export type SigningVolume = {
  id: string;
  name: string;
  signingVolume: number;
  createdAt: Date;
  planId: string;
  customerId: string;
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
    .leftJoin('User as u', 's.userId', 'u.id')
    .leftJoin('Team as t', 's.teamId', 't.id')
    .leftJoin('Document as d', (join) =>
      join
        .on((eb) =>
          eb.or([
            eb.and([eb('d.userId', '=', eb.ref('u.id')), eb('d.teamId', 'is', null)]),
            eb('d.teamId', '=', eb.ref('t.id')),
          ]),
        )
        .on('d.status', '=', sql.lit(DocumentStatus.COMPLETED))
        .on('d.deletedAt', 'is', null),
    )
    // @ts-expect-error - Raw SQL enum casting not properly typed by Kysely
    .where(sql`s.status = ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus"`)
    .where((eb) =>
      eb.or([
        eb('u.name', 'ilike', `%${search}%`),
        eb('u.email', 'ilike', `%${search}%`),
        eb('t.name', 'ilike', `%${search}%`),
      ]),
    )
    .select([
      's.planId as planId',
      's.createdAt as createdAt',
      sql<string>`COALESCE(u.customerId, t.customerId)`.as('customerId'),
      sql<string>`COALESCE(u.name, t.name, u.email, 'Unknown')`.as('name'),
      sql<number>`COUNT(DISTINCT d.id)`.as('signingVolume'),
    ])
    .groupBy([
      's.planId',
      's.createdAt',
      'u.customerId',
      't.customerId',
      'u.name',
      't.name',
      'u.email',
    ]);

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
    .leftJoin('User as u', 's.userId', 'u.id')
    .leftJoin('Team as t', 's.teamId', 't.id')
    // @ts-expect-error - Raw SQL enum casting not properly typed by Kysely
    .where(sql`s.status = ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus"`)
    .where((eb) =>
      eb.or([
        eb('u.name', 'ilike', `%${search}%`),
        eb('u.email', 'ilike', `%${search}%`),
        eb('t.name', 'ilike', `%${search}%`),
      ]),
    )
    .select(({ fn }) => [fn.countAll().as('count')]);

  const [results, [{ count }]] = await Promise.all([findQuery.execute(), countQuery.execute()]);

  return {
    leaderboard: results,
    totalPages: Math.ceil(Number(count) / perPage),
  };
}
