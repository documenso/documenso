import { z } from 'zod';

export const ZDeleteOrganisationEmailDomainRequestSchema = z.object({
  emailDomainId: z.string(),
});

export const ZDeleteOrganisationEmailDomainResponseSchema = z.void();
