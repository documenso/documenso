import type { Context } from 'hono';
import { z } from 'zod';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { TrpcContext } from '@documenso/trpc/server/context';

type CreateTrpcContextOptions = {
  c: Context;
  requestSource: 'app' | 'apiV1' | 'apiV2';
};

/**
 * For trpc that uses @documenso/auth and Hono.
 */
export const createHonoTrpcContext = async ({
  c,
  requestSource,
}: CreateTrpcContextOptions): Promise<TrpcContext> => {
  const { session, user } = await getSession(c);

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
