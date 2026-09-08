import { findTeamMembers } from '@documenso/lib/server-only/team/find-team-members';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import { ZFindTeamMembersRequestSchema, ZFindTeamMembersResponseSchema } from './find-team-members.types';

export const findTeamMembersRoute = authenticatedProcedure
  .input(ZFindTeamMembersRequestSchema)
  .output(ZFindTeamMembersResponseSchema)
  .use(twoFactorScope((input) => ({ team: input.teamId })))
  .query(async ({ input, ctx }) => {
    const { teamId, query, page, perPage } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    return await findTeamMembers({
      userId: user.id,
      teamId,
      query,
      page,
      perPage,
    });
  });
