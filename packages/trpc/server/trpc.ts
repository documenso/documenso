import { TRPCError, initTRPC } from '@trpc/server';
import type { AnyZodObject } from 'zod';

import { AppError, genericErrorCodeToTrpcErrorCodeMap } from '@documenso/lib/errors/app-error';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import type { TrpcApiLog } from '@documenso/lib/types/api-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { alphaid } from '@documenso/lib/universal/id';
import { isAdmin } from '@documenso/lib/utils/is-admin';

import { dataTransformer } from '../utils/data-transformer';
import type { TrpcContext } from './context';

// Can't import type from trpc-to-openapi because it breaks build, not sure why.
export type TrpcRouteMeta = {
  openapi?: {
    enabled?: boolean;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: `/${string}`;
    summary?: string;
    description?: string;
    protect?: boolean;
    tags?: string[];
    // eslint-disable-next-line @typescript-eslint/ban-types
    contentTypes?: ('application/json' | 'application/x-www-form-urlencoded' | (string & {}))[];
    deprecated?: boolean;
    requestHeaders?: AnyZodObject;
    responseHeaders?: AnyZodObject;
    successDescription?: string;
    errorResponses?: number[] | Record<number, string>;
  };
} & Record<string, unknown>;

const t = initTRPC
  .meta<TrpcRouteMeta>()
  .context<TrpcContext>()
  .create({
    transformer: dataTransformer,
    errorFormatter(opts) {
      const { shape, error } = opts;

      const originalError = error.cause;

      let data: Record<string, unknown> = shape.data;

      // Default unknown errors to 400, since if you're throwing an AppError it is expected
      // that you already know what you're doing.
      if (originalError instanceof AppError) {
        data = {
          ...data,
          appError: AppError.toJSON(originalError),
          code: originalError.code,
          httpStatus:
            originalError.statusCode ??
            genericErrorCodeToTrpcErrorCodeMap[originalError.code]?.status ??
            400,
        };
      }

      return {
        ...shape,
        data,
      };
    },
  });

/**
 * Middlewares
 */
export const authenticatedMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const infoToLog: TrpcApiLog = {
    path,
    auth: ctx.metadata.auth,
    source: ctx.metadata.source,
    trpcMiddleware: 'authenticated',
    unverifiedTeamId: ctx.teamId,
  };

  const authorizationHeader = ctx.req.headers.get('authorization');

  // Taken from `authenticatedMiddleware` in `@documenso/api/v1/middleware/authenticated.ts`.
  if (authorizationHeader) {
    // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
    const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

    if (!token) {
      throw new Error('Token was not provided for authenticated middleware');
    }

    const apiToken = await getApiTokenByToken({ token });

    ctx.logger.info({
      ...infoToLog,
      userId: apiToken.user.id,
      apiTokenId: apiToken.id,
    } satisfies TrpcApiLog);

    return await next({
      ctx: {
        ...ctx,
        user: apiToken.user,
        teamId: apiToken.teamId,
        session: null,
        metadata: {
          ...ctx.metadata,
          auditUser: apiToken.team
            ? {
                id: null,
                email: null,
                name: apiToken.team.name,
              }
            : {
                id: apiToken.user.id,
                email: apiToken.user.email,
                name: apiToken.user.name,
              },
          auth: 'api',
        } satisfies ApiRequestMetadata,
      },
    });
  }

  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid session or API token.',
    });
  }

  // Recreate the logger with a sub request ID to differentiate between batched requests.
  const trpcSessionLogger = ctx.logger.child({
    nonBatchedRequestId: alphaid(),
  });

  trpcSessionLogger.info({
    ...infoToLog,
    userId: ctx.user.id,
    apiTokenId: null,
  } satisfies TrpcApiLog);

  return await next({
    ctx: {
      ...ctx,
      teamId: ctx.teamId || -1,
      logger: trpcSessionLogger,
      user: ctx.user,
      session: ctx.session,
      metadata: {
        ...ctx.metadata,
        auditUser: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
        },
        auth: 'session',
      } satisfies ApiRequestMetadata,
    },
  });
});

export const maybeAuthenticatedMiddleware = t.middleware(async ({ ctx, next, path }) => {
  // Recreate the logger with a sub request ID to differentiate between batched requests.
  const trpcSessionLogger = ctx.logger.child({
    nonBatchedRequestId: alphaid(),
  });

  const infoToLog: TrpcApiLog = {
    path,
    auth: ctx.metadata.auth,
    source: ctx.metadata.source,
    trpcMiddleware: 'maybeAuthenticated',
    unverifiedTeamId: ctx.teamId,
  };

  const authorizationHeader = ctx.req.headers.get('authorization');

  // Taken from `authenticatedMiddleware` in `@documenso/api/v1/middleware/authenticated.ts`.
  if (authorizationHeader) {
    // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
    const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

    if (!token) {
      throw new Error('Token was not provided for authenticated middleware');
    }

    const apiToken = await getApiTokenByToken({ token });

    ctx.logger.info({
      ...infoToLog,
      userId: apiToken.user.id,
      apiTokenId: apiToken.id,
    } satisfies TrpcApiLog);

    return await next({
      ctx: {
        ...ctx,
        user: apiToken.user,
        teamId: apiToken.teamId,
        session: null,
        metadata: {
          ...ctx.metadata,
          auditUser: apiToken.team
            ? {
                id: null,
                email: null,
                name: apiToken.team.name,
              }
            : {
                id: apiToken.user.id,
                email: apiToken.user.email,
                name: apiToken.user.name,
              },
          auth: 'api',
        } satisfies ApiRequestMetadata,
      },
    });
  }

  trpcSessionLogger.info({
    ...infoToLog,
    userId: ctx.user?.id,
    apiTokenId: null,
  } satisfies TrpcApiLog);

  return await next({
    ctx: {
      ...ctx,
      logger: trpcSessionLogger,
      user: ctx.user,
      session: ctx.session,
      metadata: {
        ...ctx.metadata,
        auditUser: ctx.user
          ? {
              id: ctx.user.id,
              name: ctx.user.name,
              email: ctx.user.email,
            }
          : undefined,
        auth: ctx.session ? 'session' : null,
      } satisfies ApiRequestMetadata,
    },
  });
});

export const adminMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action.',
    });
  }

  const isUserAdmin = isAdmin(ctx.user);

  if (!isUserAdmin) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authorized to perform this action.',
    });
  }

  // Recreate the logger with a sub request ID to differentiate between batched requests.
  const trpcSessionLogger = ctx.logger.child({
    nonBatchedRequestId: alphaid(),
  });

  trpcSessionLogger.info({
    path,
    auth: ctx.metadata.auth,
    source: ctx.metadata.source,
    userId: ctx.user.id,
    apiTokenId: null,
    trpcMiddleware: 'admin',
  } satisfies TrpcApiLog);

  return await next({
    ctx: {
      ...ctx,
      logger: trpcSessionLogger,
      user: ctx.user,
      session: ctx.session,
      metadata: {
        ...ctx.metadata,
        auditUser: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
        },
        auth: 'session',
      } satisfies ApiRequestMetadata,
    },
  });
});

export const procedureMiddleware = t.middleware(async ({ ctx, next, path }) => {
  // Recreate the logger with a sub request ID to differentiate between batched requests.
  const trpcSessionLogger = ctx.logger.child({
    nonBatchedRequestId: alphaid(),
  });

  trpcSessionLogger.info({
    path,
    auth: ctx.metadata.auth,
    source: ctx.metadata.source,
    userId: ctx.user?.id,
    apiTokenId: null,
    trpcMiddleware: 'procedure',
  } satisfies TrpcApiLog);

  return await next({
    ctx: {
      ...ctx,
      logger: trpcSessionLogger,
    },
  });
});

/**
 * Routers and Procedures
 */
export const router = t.router;
export const procedure = t.procedure.use(procedureMiddleware);
export const authenticatedProcedure = t.procedure.use(authenticatedMiddleware);
// While this is functionally the same as `procedure`, it's useful for indicating purpose
export const maybeAuthenticatedProcedure = t.procedure.use(maybeAuthenticatedMiddleware);
export const adminProcedure = t.procedure.use(adminMiddleware);
