import { EmailDomainStatus } from '@prisma/client';
import { z } from 'zod';

import { OrganisationEmailSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationEmailSchema';

export const ZOrganisationEmailSchema = OrganisationEmailSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  emailName: true,
  // replyTo: true,
  emailDomainId: true,
  organisationId: true,
}).extend({
  emailDomain: z.object({
    id: z.string(),
    status: z.nativeEnum(EmailDomainStatus),
  }),
});

export type TOrganisationEmail = z.infer<typeof ZOrganisationEmailSchema>;

/**
 * A lite version of the organisation email response schema without relations.
 */
export const ZOrganisationEmailLiteSchema = OrganisationEmailSchema.pick({
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  emailName: true,
  // replyTo: true,
  emailDomainId: true,
  organisationId: true,
});

export const ZOrganisationEmailManySchema = ZOrganisationEmailLiteSchema.extend({
  // Put anything extra here.
});

export type TOrganisationEmailMany = z.infer<typeof ZOrganisationEmailManySchema>;
