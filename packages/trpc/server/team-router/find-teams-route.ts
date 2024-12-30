import { z } from 'zod';

import { findTeams } from '@documenso/lib/server-only/team/find-teams';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import { authenticatedProcedure } from '../trpc';

export const ZFindTeamsRequestSchema = ZFindSearchParamsSchema;

export const findTeamsRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team',
  //     summary: 'Find teams',
  //     description: 'Find your teams based on a search criteria',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZFindTeamsRequestSchema)
  .output(z.unknown())
  .query(async ({ input, ctx }) => {
    return await findTeams({
      userId: ctx.user.id,
      ...input,
    });
  });
