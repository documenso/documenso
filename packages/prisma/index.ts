import { PrismaClient } from '@prisma/client';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import kyselyExtension from 'prisma-extension-kysely';

import type { DB } from './generated/types.js';
import { getDatabaseUrl } from './helper';

declare global {
  // We need `var` to declare a global variable in TypeScript
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

if (!globalThis.prisma) {
  globalThis.prisma = new PrismaClient({ datasourceUrl: getDatabaseUrl() });
}

const _prisma =
  globalThis.prisma ||
  new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
  });

export const prisma = _prisma.$extends(
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
);

export const getPrismaClient = () => prisma;
