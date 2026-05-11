import { z } from 'zod';

import { zEmail } from '@documenso/lib/utils/zod';

export const ZCreateOrganisationEmailRequestSchema = z.object({
  emailDomainId: z.string(),
  emailName: z.string().min(1).max(100),
  email: zEmail().toLowerCase(),

  // This does not need to be validated to be part of the domain.
  // replyTo: z.string().email().optional(),
});

export const ZCreateOrganisationEmailResponseSchema = z.void();
