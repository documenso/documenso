import { z } from 'zod';

// export const deleteTeamGroupMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/groups/{id}/delete',
//     summary: 'Delete team group',
//     description: 'Delete an existing group for a team',
//     tags: ['Team'],
//   },
// };

export const ZDeleteTeamGroupRequestSchema = z.object({
  teamId: z.number(),
  teamGroupId: z.string(),
});

export const ZDeleteTeamGroupResponseSchema = z.void();
