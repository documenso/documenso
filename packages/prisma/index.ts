/// <reference types="@documenso/prisma/types/types.d.ts" />
import { PrismaClient } from '@prisma/client';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import kyselyExtension from 'prisma-extension-kysely';

import type { DB } from './generated/types';
import { getDatabaseUrl } from './helper';
import { remember } from './utils/remember';

export const prisma = remember(
  'prisma',
  () =>
    new PrismaClient({
      datasourceUrl: getDatabaseUrl(),
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

export const prismaWithLogging = remember('prismaWithLogging', () => {
  const client = new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  });

  client.$on('query', (e) => {
    console.log('query:', e.query);
    console.log('params:', e.params);
    console.log('duration:', e.duration);

    const params = JSON.parse(e.params) as unknown[];

    const query = e.query.replace(/\$\d+/g, (match) => {
      const index = Number(match.replace('$', ''));

      if (index > params.length) {
        return match;
      }

      return String(params[index - 1]);
    });

    console.log('formatted query:', query);
  });

  return client;
});

export { sql } from 'kysely';
