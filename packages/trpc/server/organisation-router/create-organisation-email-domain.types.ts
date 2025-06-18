import { z } from 'zod';

import { ZEmailDomainSchema } from '@documenso/lib/types/email-domain';

const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;

export const ZDomainSchema = z.string().regex(domainRegex, { message: 'Invalid domain name' });

export const ZCreateOrganisationEmailDomainRequestSchema = z.object({
  organisationId: z.string(),
  domain: ZDomainSchema,
});

export const ZCreateOrganisationEmailDomainResponseSchema = z.object({
  emailDomain: ZEmailDomainSchema,
  records: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      type: z.string(),
    }),
  ),
});
