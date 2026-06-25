import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_ID = 'send.recipient.removed.email';

const SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  recipientEmail: z.string(),
  recipientName: z.string(),
  inviterName: z.string().optional(),
});

export type TSendRecipientRemovedEmailJobDefinition = z.infer<
  typeof SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION = {
  id: SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Recipient Removed Email',
  version: '1.0.0',
  trigger: {
    name: SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-recipient-removed-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_RECIPIENT_REMOVED_EMAIL_JOB_DEFINITION_ID,
  TSendRecipientRemovedEmailJobDefinition
>;
