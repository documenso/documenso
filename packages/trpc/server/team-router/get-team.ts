import { getTeam } from '@documenso/lib/server-only/team/get-team';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import { ZGetTeamRequestSchema, ZGetTeamResponseSchema } from './get-team.types';

export const getTeamRoute = authenticatedProcedure
  //   .meta(getTeamMeta)
  .input(ZGetTeamRequestSchema)
  .output(ZGetTeamResponseSchema)
  .use(twoFactorScope((input) => ({ teamReference: input.teamReference })))
  .query(async ({ input, ctx }) => {
    const { teamReference } = input;

    ctx.logger.info({
      input: {
        teamReference,
      },
    });

    return await getTeam({
      teamReference,
      userId: ctx.user.id,
    });
  });
