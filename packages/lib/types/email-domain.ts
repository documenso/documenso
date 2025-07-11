import type { z } from 'zod';

import { EmailDomainSchema } from '@documenso/prisma/generated/zod/modelSchema/EmailDomainSchema';

import { ZOrganisationEmailLiteSchema } from './organisation-email';

/**
 * The full email domain response schema.
 *
 * Mainly used for returning a single email domain from the API.
 */
export const ZEmailDomainSchema = EmailDomainSchema.pick({
  id: true,
  status: true,
  organisationId: true,
  domain: true,
  selector: true,
  publicKey: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  emails: ZOrganisationEmailLiteSchema.array(),
});

export type TEmailDomain = z.infer<typeof ZEmailDomainSchema>;

/**
 * A version of the email domain response schema when returning multiple email domains at once from a single API endpoint.
 */
export const ZEmailDomainManySchema = EmailDomainSchema.pick({
  id: true,
  status: true,
  organisationId: true,
  domain: true,
  selector: true,
  createdAt: true,
  updatedAt: true,
});

export type TEmailDomainMany = z.infer<typeof ZEmailDomainManySchema>;
