import { findTeamMembers } from '@documenso/lib/server-only/team/find-team-members';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindTeamMembersRequestSchema,
  ZFindTeamMembersResponseSchema,
} from './find-team-members.types';

export const findTeamMembersRoute = authenticatedProcedure
  .input(ZFindTeamMembersRequestSchema)
  .output(ZFindTeamMembersResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, query, page, perPage } = input;
    const { user } = ctx;

    return await findTeamMembers({
      userId: user.id,
      teamId,
      query,
      page,
      perPage,
    });
  });
