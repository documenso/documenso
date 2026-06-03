// ABOUTME: TRPC query route for team merge preview — returns impact counts without mutating.
// ABOUTME: Requires MANAGE_ORGANISATION permission.
import { mergeTeamsPreview } from '@documenso/lib/server-only/team/merge-teams';

import { authenticatedProcedure } from '../trpc';
import {
  ZMergeTeamsPreviewRequestSchema,
  ZMergeTeamsPreviewResponseSchema,
} from './merge-teams.types';

export const mergeTeamsPreviewRoute = authenticatedProcedure
  .input(ZMergeTeamsPreviewRequestSchema)
  .output(ZMergeTeamsPreviewResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, sourceTeamIds, destinationTeamId } = input;

    ctx.logger.info({
      input: { organisationId, sourceTeamIds, destinationTeamId },
    });

    return await mergeTeamsPreview({
      userId: ctx.user.id,
      organisationId,
      sourceTeamIds,
      destinationTeamId,
    });
  });
