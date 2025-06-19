import { createTeam } from '@documenso/lib/server-only/team/create-team';

import { authenticatedProcedure } from '../trpc';
import { ZCreateTeamRequestSchema, ZCreateTeamResponseSchema } from './create-team.types';

export const createTeamRoute = authenticatedProcedure
  // .meta(createOrganisationGroupMeta)
  .input(ZCreateTeamRequestSchema)
  .output(ZCreateTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamName, teamUrl, organisationId, inheritMembers } = input;
    const { user } = ctx;

    return await createTeam({
      userId: user.id,
      teamName,
      teamUrl,
      organisationId,
      inheritMembers,
    });
  });
