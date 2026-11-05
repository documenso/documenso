import { z } from 'zod';

import { ZCreateOrganisationEmailRequestSchema } from './create-organisation-email.types';

export const ZUpdateOrganisationEmailRequestSchema = z
  .object({
    emailId: z.string(),
  })
  .merge(
    ZCreateOrganisationEmailRequestSchema.pick({
      emailName: true,
      // replyTo: true
    }),
  );

export const ZUpdateOrganisationEmailResponseSchema = z.void();

export type TUpdateOrganisationEmailRequest = z.infer<typeof ZUpdateOrganisationEmailRequestSchema>;
