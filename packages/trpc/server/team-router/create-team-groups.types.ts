import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

// export const createTeamGroupsMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/{teamId}/groups',
//     summary: 'Create team group',
//     description: 'Create a new group for a team',
//     tags: ['Team'],
//   },
// };

export const ZCreateTeamGroupsRequestSchema = z.object({
  teamId: z.number(),
  groups: z.array(
    z.object({
      teamRole: z.nativeEnum(TeamMemberRole).describe('The team role to assign to the group'),
      organisationGroupId: z
        .string()
        .describe(
          'The ID of the organisation group to create the team group from. Members from the organisation group will be assigned automatically to this team group.',
        ),
    }),
  ),
});

export const ZCreateTeamGroupsResponseSchema = z.void();
