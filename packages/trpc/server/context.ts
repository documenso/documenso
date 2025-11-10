import type { Session } from '@prisma/client';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import type { RootApiLog } from '@documenso/lib/types/api-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { alphaid } from '@documenso/lib/universal/id';
import { logger } from '@documenso/lib/utils/logger';
// This is a bit nasty. Todo: Extract
import type { HonoEnv } from '@documenso/remix/server/router';

type CreateTrpcContextOptions = {
  c: Context<HonoEnv>;
  requestSource: 'app' | 'apiV1' | 'apiV2';
};

export const createTrpcContext = async ({
  c,
  requestSource,
}: CreateTrpcContextOptions): Promise<TrpcContext> => {
  const { session, user } = await getOptionalSession(c);

  const req = c.req.raw;
  const res = c.res;

  const requestMetadata = c.get('context').requestMetadata;

  const metadata: ApiRequestMetadata = {
    requestMetadata,
    source: requestSource,
    auth: null,
  };

  const rawTeamId = req.headers.get('x-team-id') || undefined;

  const trpcLogger = logger.child({
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    requestId: alphaid(),
  } satisfies RootApiLog);

  const teamId = z.coerce
    .number()
    .optional()
    .catch(() => undefined)
    .parse(rawTeamId);

  if (!session || !user) {
    return {
      logger: trpcLogger,
      session: null,
      user: null,
      teamId,
      req,
      res,
      metadata,
    };
  }

  return {
    logger: trpcLogger,
    session,
    user,
    teamId,
    req,
    res,
    metadata,
  };
};

export type TrpcContext = (
  | {
      session: null;
      user: null;
    }
  | {
      session: Session;
      user: SessionUser;
    }
) & {
  teamId: number | undefined;
  req: Request;
  res: Response;
  metadata: ApiRequestMetadata;
  logger: Logger;
};
