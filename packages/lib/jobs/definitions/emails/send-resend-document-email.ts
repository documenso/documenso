import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_ID = 'send.resend.document.email';

const SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  userId: z.number(),
  teamId: z.number(),
  recipientIds: z.array(z.number()),
  requestMetadata: z.any().optional(),
});

export type TSendResendDocumentEmailJobDefinition = z.infer<
  typeof SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION = {
  id: SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Resend Document Email',
  version: '1.0.0',
  trigger: {
    name: SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-resend-document-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_RESEND_DOCUMENT_EMAIL_JOB_DEFINITION_ID,
  TSendResendDocumentEmailJobDefinition
>;
