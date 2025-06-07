import { z } from 'zod';

import { OrganisationMemberRole, TeamMemberRole } from '@documenso/prisma/generated/types';
import OrganisationMemberSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationMemberSchema';

// export const getTeamMembersMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/team/{teamId}/members',
//     summary: 'Get team members',
//     description: 'Get all members of a team',
//     tags: ['team'],
//   },
// };

export const ZGetTeamMembersRequestSchema = z.object({
  teamId: z.number(),
});

export const ZGetTeamMembersResponseSchema = OrganisationMemberSchema.pick({
  id: true,
  createdAt: true,
  userId: true,
})
  .extend({
    teamRole: z.nativeEnum(TeamMemberRole),
    organisationRole: z.nativeEnum(OrganisationMemberRole),
    email: z.string(),
    name: z.string().nullable(),
    avatarImageId: z.string().nullable(),
  })
  .array();

export type TGetTeamMembersResponse = z.infer<typeof ZGetTeamMembersResponseSchema>;
