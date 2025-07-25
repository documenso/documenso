import { z } from 'zod';

import { ZDomainSchema } from '@documenso/lib/utils/domain';

export const ZAddOrganisationDomainRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to add the domain to'),
  domain: ZDomainSchema.describe('The domain to add for auto-assignment'),
});

export const ZAddOrganisationDomainResponseSchema = z.object({
  id: z.string(),
  domain: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TAddOrganisationDomainRequestSchema = z.infer<
  typeof ZAddOrganisationDomainRequestSchema
>;

export type TAddOrganisationDomainResponseSchema = z.infer<
  typeof ZAddOrganisationDomainResponseSchema
>;
