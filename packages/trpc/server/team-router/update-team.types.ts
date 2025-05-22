import { z } from 'zod';

import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

// export const updateTeamMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/{teamId}',
//     summary: 'Update team',
//     description: 'Update an team',
//     tags: ['team'],
//   },
// };

export const ZUpdateTeamRequestSchema = z.object({
  teamId: z.number(),
  data: z.object({
    name: ZTeamNameSchema,
    url: ZTeamUrlSchema,
  }),
});

export const ZUpdateTeamResponseSchema = z.void();
