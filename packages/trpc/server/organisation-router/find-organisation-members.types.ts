import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import OrganisationMemberRoleSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/OrganisationMemberRoleSchema';
import OrganisationGroupSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationGroupSchema';
import { OrganisationMemberSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationMemberSchema';

// export const getOrganisationMembersMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/organisation/{teamId}/members',
//     summary: 'Find organisation members',
//     description: 'Find all members of a organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZFindOrganisationMembersRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
});

export const ZFindOrganisationMembersResponseSchema = ZFindResultResponse.extend({
  data: OrganisationMemberSchema.pick({
    id: true,
    createdAt: true,
    userId: true,
  })
    .extend({
      email: z.string(),
      name: z.string(),
      avatarImageId: z.string().nullable(),
      currentOrganisationRole: OrganisationMemberRoleSchema,
      groups: z.array(
        OrganisationGroupSchema.pick({
          id: true,
          organisationRole: true,
          type: true,
        }),
      ),
    })
    .array(),
});

export type TFindOrganisationMembersResponse = z.infer<
  typeof ZFindOrganisationMembersResponseSchema
>;
