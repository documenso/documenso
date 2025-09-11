import { z } from 'zod';

import { ZEmailDomainSchema } from '@documenso/lib/types/email-domain';

export const domainRegex =
  /^(?!https?:\/\/)(?!www\.)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const ZDomainSchema = z
  .string()
  .regex(domainRegex, { message: 'Invalid domain name' })
  .toLowerCase();

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
