/// <reference types="@documenso/prisma/types/types.d.ts" />
import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import kyselyExtension from 'prisma-extension-kysely';

import type { DB } from './generated/types';
import { getDatabaseUrl } from './helper';
import { remember } from './utils/remember';

const prisma = remember(
  'prisma',
  () =>
    new PrismaClient({
      datasourceUrl: getDatabaseUrl(),
      transactionOptions: {
        maxWait: 5000,
        timeout: 10000,
      },
    }),
);

export const kyselyPrisma = remember('kyselyPrisma', () =>
  prisma.$extends(
    kyselyExtension({
      kysely: (driver) =>
        new Kysely<DB>({
          dialect: {
            createAdapter: () => new PostgresAdapter(),
            createDriver: () => driver,
            createIntrospector: (db) => new PostgresIntrospector(db),
            createQueryCompiler: () => new PostgresQueryCompiler(),
          },
        }),
    }),
  ),
);

export const prismaWithReplicas = remember('prismaWithReplicas', () => {
  if (!process.env.NEXT_PRIVATE_DATABASE_REPLICA_URLS) {
    return prisma;
  }

  const replicaUrls = process.env.NEXT_PRIVATE_DATABASE_REPLICA_URLS.split(',').map((url) => url.trim());

  // !: Nasty hack, means we can't do any fancy $primary/$replica queries
  // !: but it is acceptable since not all setups will have replicas anyway.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return prisma.$extends(
    readReplicas({
      url: replicaUrls,
    }),
  ) as unknown as typeof prisma;
});

export { sql } from 'kysely';
export { prismaWithReplicas as prisma };
