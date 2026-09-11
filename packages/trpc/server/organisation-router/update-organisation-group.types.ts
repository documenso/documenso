import { ZNameSchema } from '@documenso/lib/types/name';
import { OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

// export const updateOrganisationGroupMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/groups/{id}',
//     summary: 'Update organisation group',
//     description: 'Update an existing group for a organisation',
//     tags: ['Organisation'],
//     requiredScopes: ['personal:organisation:write'],
//   },
// };

export const ZUpdateOrganisationGroupRequestSchema = z.object({
  id: z.string(),
  name: ZNameSchema.nullable().optional(),
  organisationRole: z.nativeEnum(OrganisationMemberRole).optional(),
  memberIds: z.array(z.string()).optional(),
});

export const ZUpdateOrganisationGroupResponseSchema = z.void();

export type TUpdateOrganisationGroupRequest = z.infer<typeof ZUpdateOrganisationGroupRequestSchema>;
