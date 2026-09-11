import type { logger } from '@documenso/lib/utils/logger';

/**
 * CSC subapp Hono context. Mirrors the subset of `apps/remix/server/router.ts`
 * `HonoEnv` that CSC handlers actually read. Duplicated (rather than imported
 * from `apps/remix/`) to keep the `packages/ee` → `apps/remix` dep direction
 * unidirectional.
 *
 * Runtime contract: the remix host's middleware sets `logger` on every request
 * before the CSC subapp runs; the CSC subapp does not set it itself.
 */
export type HonoCscEnv = {
  Variables: {
    logger: typeof logger;
  };
};
