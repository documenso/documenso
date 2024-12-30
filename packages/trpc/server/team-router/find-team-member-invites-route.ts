import { z } from 'zod';

import { findTeamMemberInvites } from '@documenso/lib/server-only/team/find-team-member-invites';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import { authenticatedProcedure } from '../trpc';

export const ZFindTeamMemberInvitesRequestSchema = ZFindSearchParamsSchema.extend({
  teamId: z.number(),
});

export const findTeamMemberInvitesRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team/{teamId}/member/invite',
  //     summary: 'Find member invites',
  //     description: 'Returns pending team member invites',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZFindTeamMemberInvitesRequestSchema)
  .output(z.unknown())
  .query(async ({ input, ctx }) => {
    return await findTeamMemberInvites({
      userId: ctx.user.id,
      ...input,
    });
  });
