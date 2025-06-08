import { z } from 'zod';

import { ZOrganisationNameSchema } from '../organisation-router/create-organisation.types';

export const ZCreateAdminOrganisationRequestSchema = z.object({
  ownerUserId: z.number(),
  data: z.object({
    name: ZOrganisationNameSchema,
  }),
});

export const ZCreateAdminOrganisationResponseSchema = z.object({
  organisationId: z.string(),
});

export type TCreateAdminOrganisationRequest = z.infer<typeof ZCreateAdminOrganisationRequestSchema>;
