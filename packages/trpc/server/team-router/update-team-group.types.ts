import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

// export const updateTeamGroupMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/groups/{id}',
//     summary: 'Update team group',
//     description: 'Update an existing group for a team',
//     tags: ['Team'],
//     requiredScopes: ['personal:team:write'],
//   },
// };

export const ZUpdateTeamGroupRequestSchema = z.object({
  id: z.string(),
  data: z.object({
    teamRole: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZUpdateTeamGroupResponseSchema = z.void();

export type TUpdateTeamGroupRequest = z.infer<typeof ZUpdateTeamGroupRequestSchema>;
