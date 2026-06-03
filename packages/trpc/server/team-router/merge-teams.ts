// ABOUTME: TRPC mutation route for team merge — merges source teams into a destination team.
// ABOUTME: Requires MANAGE_ORGANISATION permission. Destructive and irreversible.
import { mergeTeams } from '@documenso/lib/server-only/team/merge-teams';

import { authenticatedProcedure } from '../trpc';
import { ZMergeTeamsRequestSchema, ZMergeTeamsResponseSchema } from './merge-teams.types';

export const mergeTeamsRoute = authenticatedProcedure
  .input(ZMergeTeamsRequestSchema)
  .output(ZMergeTeamsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, sourceTeamIds, destinationTeamId, newTeamName, newTeamUrl } = input;

    ctx.logger.info({
      input: { organisationId, sourceTeamIds, destinationTeamId },
    });

    return await mergeTeams({
      userId: ctx.user.id,
      organisationId,
      sourceTeamIds,
      destinationTeamId,
      newTeamName,
      newTeamUrl,
    });
  });
