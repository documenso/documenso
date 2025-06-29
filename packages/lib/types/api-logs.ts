import type { ApiRequestMetadata } from '../universal/extract-request-metadata';

/**
 * The minimum required fields that the parent API logger must contain.
 */
export type RootApiLog = {
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
};

/**
 * The minimum API log that must be logged at the start of every API request.
 */
export type BaseApiLog = Partial<RootApiLog> & {
  path: string;
  auth: ApiRequestMetadata['auth'];
  source: ApiRequestMetadata['source'];
  userId?: number | null;
  apiTokenId?: number | null;
};

/**
 * The TRPC API log.
 */
export type TrpcApiLog = BaseApiLog & {
  trpcMiddleware: string;
  unverifiedTeamId?: number | null;
};
