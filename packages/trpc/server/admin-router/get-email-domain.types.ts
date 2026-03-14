import { z } from 'zod';

import { ZOrganisationEmailLiteSchema } from '@documenso/lib/types/organisation-email';
import EmailDomainSchema from '@documenso/prisma/generated/zod/modelSchema/EmailDomainSchema';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';

export const ZGetEmailDomainRequestSchema = z.object({
  emailDomainId: z.string(),
});

export const ZGetEmailDomainResponseSchema = EmailDomainSchema.pick({
  id: true,
  domain: true,
  status: true,
  selector: true,
  publicKey: true,
  createdAt: true,
  updatedAt: true,
  lastVerifiedAt: true,
}).extend({
  organisation: OrganisationSchema.pick({
    id: true,
    name: true,
    url: true,
  }),
  emails: ZOrganisationEmailLiteSchema.array(),
});

export type TGetEmailDomainRequest = z.infer<typeof ZGetEmailDomainRequestSchema>;
export type TGetEmailDomainResponse = z.infer<typeof ZGetEmailDomainResponseSchema>;
