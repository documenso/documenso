import { z } from 'zod';

export const ZVerifyOrganisationEmailDomainRequestSchema = z.object({
  organisationId: z.string(),
  emailDomainId: z.string().optional().describe('Leave blank to revalidate all emails'),
});

export const ZVerifyOrganisationEmailDomainResponseSchema = z.void();
