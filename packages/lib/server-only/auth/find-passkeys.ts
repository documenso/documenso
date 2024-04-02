import type { FindResultSet } from '@documenso/lib/types/find-result-set';
import { prisma } from '@documenso/prisma';
import type { Passkey } from '@documenso/prisma/client';
import { Prisma } from '@documenso/prisma/client';

export interface FindPasskeysOptions {
  userId: number;
  term?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Passkey;
    direction: 'asc' | 'desc';
    nulls?: Prisma.NullsOrder;
  };
}

export const findPasskeys = async ({
  userId,
  term = '',
  page = 1,
  perPage = 10,
  orderBy,
}: FindPasskeysOptions) => {
  const orderByColumn = orderBy?.column ?? 'lastUsedAt';
  const orderByDirection = orderBy?.direction ?? 'desc';
  const orderByNulls: Prisma.NullsOrder | undefined = orderBy?.nulls ?? 'last';

  const whereClause: Prisma.PasskeyWhereInput = {
    userId,
  };

  if (term.length > 0) {
    whereClause.name = {
      contains: term,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.passkey.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: {
          sort: orderByDirection,
          nulls: orderByNulls,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
        counter: true,
        credentialDeviceType: true,
        credentialBackedUp: true,
        transports: true,
      },
    }),
    prisma.passkey.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultSet<typeof data>;
};
