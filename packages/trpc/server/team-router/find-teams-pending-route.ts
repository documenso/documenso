import { findTeamsPending } from '@documenso/lib/server-only/team/find-teams-pending';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import { authenticatedProcedure } from '../trpc';

export const ZFindTeamsPendingRequestSchema = ZFindSearchParamsSchema;

export const findTeamsPendingRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team/pending',
  //     summary: 'Find pending teams',
  //     description: 'Find teams that are pending payment',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZFindTeamsPendingRequestSchema)
  .query(async ({ input, ctx }) => {
    return await findTeamsPending({
      userId: ctx.user.id,
      ...input,
    });
  });
