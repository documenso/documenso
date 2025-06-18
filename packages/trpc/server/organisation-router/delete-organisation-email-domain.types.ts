import { z } from 'zod';

export const ZDeleteOrganisationEmailDomainRequestSchema = z.object({
  organisationId: z.string(),
  emailDomainId: z.string(),
});

export const ZDeleteOrganisationEmailDomainResponseSchema = z.void();
