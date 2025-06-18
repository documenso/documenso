import type { z } from 'zod';

import { EmailDomainSchema } from '@documenso/prisma/generated/zod/modelSchema/EmailDomainSchema';

/**
 * The full document response schema.
 *
 * Mainly used for returning a single document from the API.
 */
export const ZEmailDomainSchema = EmailDomainSchema.pick({
  status: true,
  id: true,
  organisationId: true,
  domain: true,
  createdAt: true,
  updatedAt: true,
  verifiedAt: true,
});

export type TEmailDomain = z.infer<typeof ZEmailDomainSchema>;
