import { getTeamMembers } from '@documenso/lib/server-only/team/get-team-members';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTeamMembersRequestSchema,
  ZGetTeamMembersResponseSchema,
} from './get-team-members.types';

export const getTeamMembersRoute = authenticatedProcedure
  //   .meta(getTeamMembersMeta)
  .input(ZGetTeamMembersRequestSchema)
  .output(ZGetTeamMembersResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    return await getTeamMembers({
      userId: user.id,
      teamId,
    });
  });
