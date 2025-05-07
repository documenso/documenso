import { z } from 'zod';

import { ZTeamUrlSchema } from '../team-router/schema';

// export const createOrganisationMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation',
//     summary: 'Create organisation',
//     description: 'Create an organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZOrganisationNameSchema = z
  .string()
  .min(3, { message: 'Minimum 3 characters' })
  .max(50, { message: 'Maximum 50 characters' });

export const ZCreateOrganisationRequestSchema = z.object({
  name: ZOrganisationNameSchema,
  url: ZTeamUrlSchema,
});

export const ZCreateOrganisationResponseSchema = z.void();
