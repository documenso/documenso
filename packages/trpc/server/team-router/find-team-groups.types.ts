import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { TeamGroupSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamGroupSchema';

// export const getTeamGroupsMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/team/{teamId}/groups',
//     summary: 'Get team groups',
//     description: 'Get all groups for a team',
//     tags: ['Team'],
//   },
// };

export const ZFindTeamGroupsRequestSchema = ZFindSearchParamsSchema.extend({
  teamId: z.number(),
  teamGroupId: z.string().optional(),
  organisationRoles: z.nativeEnum(OrganisationMemberRole).array().optional(),
  types: z.nativeEnum(OrganisationGroupType).array().optional(),
});

export const ZFindTeamGroupsResponseSchema = ZFindResultResponse.extend({
  data: TeamGroupSchema.pick({
    teamRole: true,
    id: true,
    teamId: true,
  })
    .extend({
      name: z.string(),
      organisationGroupId: z.string(),
      organisationGroupType: z.nativeEnum(OrganisationGroupType),
      members: z
        .object({
          id: z.string(),
          userId: z.number(),
          name: z.string(),
          email: z.string(),
          avatarImageId: z.string().nullable(),
        })
        .array(),
    })
    .array(),
});

export type TFindTeamGroupsResponse = z.infer<typeof ZFindTeamGroupsResponseSchema>;
