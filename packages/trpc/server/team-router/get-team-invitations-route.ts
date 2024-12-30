import { z } from 'zod';

import { getTeamInvitations } from '@documenso/lib/server-only/team/get-team-invitations';

import { authenticatedProcedure } from '../trpc';

export const getTeamInvitationsRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team/invite',
  //     summary: 'Get team invitations',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(z.void())
  .query(async ({ ctx }) => {
    return await getTeamInvitations({ email: ctx.user.email });
  });
