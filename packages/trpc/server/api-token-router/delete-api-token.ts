import { deleteTokenById } from '@documenso/lib/server-only/public-api/delete-api-token-by-id';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import { ZDeleteApiTokenRequestSchema, ZDeleteApiTokenResponseSchema } from './delete-api-token.types';

export const deleteApiTokenRoute = authenticatedProcedure
  .input(ZDeleteApiTokenRequestSchema)
  .output(ZDeleteApiTokenResponseSchema)
  .use(twoFactorScope((input) => ({ team: input.teamId })))
  .mutation(async ({ input, ctx }) => {
    const { id, teamId } = input;

    ctx.logger.info({
      input: {
        id,
        teamId,
      },
    });

    await deleteTokenById({
      id,
      teamId,
      userId: ctx.user.id,
    });
  });
