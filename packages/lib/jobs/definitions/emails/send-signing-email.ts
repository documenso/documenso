import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const SEND_SIGNING_EMAIL_JOB_DEFINITION_ID = 'send.signing.requested.email';

const SEND_SIGNING_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  documentId: z.number(),
  recipientId: z.number(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TSendSigningEmailJobDefinition = z.infer<
  typeof SEND_SIGNING_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_SIGNING_EMAIL_JOB_DEFINITION = {
  id: SEND_SIGNING_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Signing Email',
  version: '1.0.0',
  trigger: {
    name: SEND_SIGNING_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_SIGNING_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-signing-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_SIGNING_EMAIL_JOB_DEFINITION_ID,
  TSendSigningEmailJobDefinition
>;
