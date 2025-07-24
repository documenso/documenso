import { z } from 'zod';

export const ZCreateOrganisationEmailRequestSchema = z.object({
  emailDomainId: z.string(),
  emailName: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),

  // This does not need to be validated to be part of the domain.
  // replyTo: z.string().email().optional(),
});

export const ZCreateOrganisationEmailResponseSchema = z.void();
