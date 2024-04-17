import { TRPCError, initTRPC } from '@trpc/server';
import SuperJSON from 'superjson';

import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';

import { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: SuperJSON,
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
export const adminProcedure = t.procedure.use(adminMiddleware);
