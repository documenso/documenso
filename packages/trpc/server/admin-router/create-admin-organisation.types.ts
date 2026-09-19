import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

export const ZCreateAdminOrganisationRequestSchema = z.object({
  ownerUserId: z.number(),
  data: z.object({
    name: ZNameSchema,
  }),
});

export const ZCreateAdminOrganisationResponseSchema = z.object({
  organisationId: z.string(),
});

export type TCreateAdminOrganisationRequest = z.infer<typeof ZCreateAdminOrganisationRequestSchema>;
