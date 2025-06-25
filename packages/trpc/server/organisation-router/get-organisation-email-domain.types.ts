import { z } from 'zod';

import { ZEmailDomainSchema } from '@documenso/lib/types/email-domain';

export const ZGetOrganisationEmailDomainRequestSchema = z.object({
  emailDomainId: z.string(),
});

export const ZGetOrganisationEmailDomainResponseSchema = ZEmailDomainSchema;

export type TGetOrganisationEmailDomainResponse = z.infer<
  typeof ZGetOrganisationEmailDomainResponseSchema
>;
