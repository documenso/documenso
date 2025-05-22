import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { OrganisationGroupSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationGroupSchema';

// export const getOrganisationGroupsMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/organisation/{teamId}/groups',
//     summary: 'Get organisation groups',
//     description: 'Get all groups for a organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZFindOrganisationGroupsRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
  organisationGroupId: z.string().optional(),
  organisationRoles: z.nativeEnum(OrganisationMemberRole).array().optional(),
  types: z.nativeEnum(OrganisationGroupType).array().optional(),
});

export const ZFindOrganisationGroupsResponseSchema = ZFindResultResponse.extend({
  data: OrganisationGroupSchema.pick({
    type: true,
    organisationRole: true,
    id: true,
    name: true,
    organisationId: true,
  })
    .extend({
      members: z
        .object({
          id: z.string(),
          userId: z.number(),
          name: z.string(),
          email: z.string(),
          avatarImageId: z.string().nullable(),
        })
        .array(),
      teams: z
        .object({
          id: z.number(),
          name: z.string(),
          teamGroupId: z.string(),
          teamRole: z.nativeEnum(TeamMemberRole),
        })
        .array(),
    })
    .array(),
});

export type TFindOrganisationGroupsResponse = z.infer<typeof ZFindOrganisationGroupsResponseSchema>;
