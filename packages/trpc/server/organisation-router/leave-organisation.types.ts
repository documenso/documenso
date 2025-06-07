import { z } from 'zod';

export const ZLeaveOrganisationRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZLeaveOrganisationResponseSchema = z.void();
