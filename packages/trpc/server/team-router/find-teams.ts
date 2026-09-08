import { findTeams } from '@documenso/lib/server-only/team/find-teams';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import { ZFindTeamsRequestSchema, ZFindTeamsResponseSchema } from './find-teams.types';

export const findTeamsRoute = authenticatedProcedure
  //   .meta(getTeamsMeta)
  .input(ZFindTeamsRequestSchema)
  .output(ZFindTeamsResponseSchema)
  .use(twoFactorScope((input) => ({ organisation: input.organisationId })))
  .query(async ({ ctx, input }) => {
    const { organisationId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return findTeams({ userId: user.id, organisationId });
  });
