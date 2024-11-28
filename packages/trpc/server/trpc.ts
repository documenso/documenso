import { TRPCError, initTRPC } from '@trpc/server';
import SuperJSON from 'superjson';

import { AppError, genericErrorCodeToTrpcErrorCodeMap } from '@documenso/lib/errors/app-error';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';

import type { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: SuperJSON,
  errorFormatter(opts) {
    const { shape, error } = opts;

    const originalError = error.cause;

    let data: Record<string, unknown> = shape.data;

    if (originalError instanceof AppError) {
      data = {
        ...data,
        appError: AppError.toJSON(originalError),
        code: originalError.code,
        httpStatus:
          originalError.statusCode ??
          genericErrorCodeToTrpcErrorCodeMap[originalError.code]?.status ??
          500,
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
export const authenticatedMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action.',
    });
  }

  return await next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});

export const maybeAuthenticatedMiddleware = t.middleware(async ({ ctx, next }) => {
  return await next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});

export const adminMiddleware = t.middleware(async ({ ctx, next }) => {
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

  return await next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});

/**
 * Routers and Procedures
 */
export const router = t.router;
export const procedure = t.procedure;
export const authenticatedProcedure = t.procedure.use(authenticatedMiddleware);
// While this is functionally the same as `procedure`, it's useful for indicating purpose
export const maybeAuthenticatedProcedure = t.procedure.use(maybeAuthenticatedMiddleware);
export const adminProcedure = t.procedure.use(adminMiddleware);
