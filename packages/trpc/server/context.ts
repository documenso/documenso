import type { Session } from '@prisma/client';
import type { Context } from 'hono';
import { z } from 'zod';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

type CreateTrpcContextOptions = {
  c: Context;
  requestSource: 'app' | 'apiV1' | 'apiV2';
};

export const createTrpcContext = async ({
  c,
  requestSource,
}: CreateTrpcContextOptions): Promise<TrpcContext> => {
  const { session, user } = await getOptionalSession(c);

  const req = c.req.raw;

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
      session: null,
      user: null,
      teamId,
      req,
      metadata,
    };
  }

  return {
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
};
