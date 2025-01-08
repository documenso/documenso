import { z } from 'zod';

import { getServerSession } from '@documenso/lib/next-auth/get-server-session';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import type { CreateNextContextOptions } from './adapters/next';

type CreateTrpcContext = CreateNextContextOptions & {
  requestSource: 'apiV1' | 'apiV2' | 'app';
};

export const createTrpcContext = async ({ req, res, requestSource }: CreateTrpcContext) => {
  const { session, user } = await getServerSession({ req, res });

  const metadata: ApiRequestMetadata = {
    requestMetadata: extractNextApiRequestMetadata(req),
    source: requestSource,
    auth: null,
  };

  const teamId = z.coerce
    .number()
    .optional()
    .catch(() => undefined)
    .parse(req.headers['x-team-id']);

  if (!session) {
    return {
      session: null,
      user: null,
      teamId,
      req,
      metadata,
    };
  }

  if (!user) {
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

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
