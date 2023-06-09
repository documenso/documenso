import { TRPCError, initTRPC } from '@trpc/server';
import SuperJSON from 'superjson';

import { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: SuperJSON,
});

/**
 * Middlewares
 */
export const authenticatedMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action.',
    });
  }

  return next({
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
