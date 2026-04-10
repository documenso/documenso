import { ZEmailDomainSchema } from '@documenso/lib/types/email-domain';
import { z } from 'zod';

export const ZGetOrganisationEmailDomainRequestSchema = z.object({
  emailDomainId: z.string(),
});

export const ZGetOrganisationEmailDomainResponseSchema = ZEmailDomainSchema;

export type TGetOrganisationEmailDomainResponse = z.infer<typeof ZGetOrganisationEmailDomainResponseSchema>;
