import { z } from 'zod';

import { ZCreateOrganisationRequestSchema } from './create-organisation.types';

// export const updateOrganisationMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/{teamId}',
//     summary: 'Update organisation',
//     description: 'Update an organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZUpdateOrganisationRequestSchema = z.object({
  data: ZCreateOrganisationRequestSchema.pick({
    name: true,
    url: true,
  }),
  organisationId: z.string(),
});

export const ZUpdateOrganisationResponseSchema = z.void();
