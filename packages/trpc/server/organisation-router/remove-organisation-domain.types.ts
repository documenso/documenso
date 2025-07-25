import { z } from 'zod';

import { ZDomainSchema } from '@documenso/lib/utils/domain';

export const ZRemoveOrganisationDomainRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to remove the domain from'),
  domain: ZDomainSchema.describe('The domain to remove'),
});

export const ZRemoveOrganisationDomainResponseSchema = z.object({
  success: z.boolean(),
});

export type TRemoveOrganisationDomainRequestSchema = z.infer<
  typeof ZRemoveOrganisationDomainRequestSchema
>;

export type TRemoveOrganisationDomainResponseSchema = z.infer<
  typeof ZRemoveOrganisationDomainResponseSchema
>;
