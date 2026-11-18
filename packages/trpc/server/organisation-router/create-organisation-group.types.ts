import { ZNameSchema } from '@documenso/lib/types/name';
import { OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

// export const createOrganisationGroupMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/{teamId}/groups',
//     summary: 'Create organisation group',
//     description: 'Create a new group for a organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZCreateOrganisationGroupRequestSchema = z.object({
  organisationId: z.string(),
  organisationRole: z.nativeEnum(OrganisationMemberRole),
  name: ZNameSchema,
  memberIds: z.array(z.string()),
});

export const ZCreateOrganisationGroupResponseSchema = z.void();
