import { z } from 'zod';

export const ZDeleteOrganisationEmailRequestSchema = z.object({
  emailId: z.string(),
});

export const ZDeleteOrganisationEmailResponseSchema = z.void();
