import { z } from 'zod';

import { ZTeamUrlSchema } from './schema';
import { ZTeamNameSchema } from './schema';

// export const createTeamMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/create',
//     summary: 'Create team',
//     description: 'Create a new team',
//     tags: ['Team'],
//   },
// };

export const ZCreateTeamRequestSchema = z.object({
  organisationId: z.string(),
  teamName: ZTeamNameSchema,
  teamUrl: ZTeamUrlSchema,
  inheritMembers: z
    .boolean()
    .describe(
      'Whether to automatically assign all current and future organisation members to the new team. Defaults to true.',
    ),
});

export const ZCreateTeamResponseSchema = z.void();

export type TCreateTeamRequest = z.infer<typeof ZCreateTeamRequestSchema>;
