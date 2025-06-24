import { z } from 'zod';

// export const deleteOrganisationMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'DELETE',
//     path: '/organisation/{teamId}',
//     summary: 'Delete organisation',
//     description: 'Delete an existing organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZDeleteOrganisationRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZDeleteOrganisationResponseSchema = z.void();
