import { findTeams } from '@documenso/lib/server-only/team/find-teams';

import { authenticatedProcedure } from '../trpc';
import { ZFindTeamsRequestSchema, ZFindTeamsResponseSchema } from './find-teams.types';

export const findTeamsRoute = authenticatedProcedure
  //   .meta(getTeamsMeta)
  .input(ZFindTeamsRequestSchema)
  .output(ZFindTeamsResponseSchema)
  .query(async ({ ctx, input }) => {
    const { organisationId, query, page, perPage } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
        query,
        page,
        perPage,
      },
    });

    return findTeams({
      userId: user.id,
      organisationId,
      query,
      page,
      perPage,
    });
  });
