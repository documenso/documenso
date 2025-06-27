import type { Session } from '@prisma/client';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
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
  const logger = c.get('logger');

  const metadata: ApiRequestMetadata = {
    requestMetadata: extractRequestMetadata(req),
    source: requestSource,
    auth: null,
  };

  const rawTeamId = req.headers.get('x-team-id') || undefined;

  const teamId = z.coerce
    .number()
    .optional()
    .catch(() => undefined)
    .parse(rawTeamId);

  if (!session || !user) {
    return {
      logger,
      session: null,
      user: null,
      teamId,
      req,
      metadata,
    };
  }

  return {
    logger,
    session,
    user,
    teamId,
    req,
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
  metadata: ApiRequestMetadata;
  logger: Logger;
};
