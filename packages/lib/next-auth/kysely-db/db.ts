import { KyselyAuth } from '@auth/kysely-adapter';
import type { Codegen } from '@auth/kysely-adapter';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { DB } from '@documenso/prisma/generated/types';

export const db = new KyselyAuth<DB, Codegen>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});
