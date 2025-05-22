import { z } from 'zod';

// export const deleteTeamMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'DELETE',
//     path: '/team/{teamId}',
//     summary: 'Delete team',
//     description: 'Delete an existing team',
//     tags: ['Team'],
//   },
// };

export const ZDeleteTeamRequestSchema = z.object({
  teamId: z.number(),
});

export const ZDeleteTeamResponseSchema = z.void();
