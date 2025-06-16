import { z } from 'zod';

// export const deleteOrganisationGroupMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/groups/{id}/delete',
//     summary: 'Delete organisation group',
//     description: 'Delete an existing group for a organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZDeleteOrganisationGroupRequestSchema = z.object({
  organisationId: z.string(),
  groupId: z.string(),
});

export const ZDeleteOrganisationGroupResponseSchema = z.void();
