import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_ID = 'send.owner.recipient.expired.email';

const SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  recipientId: z.number(),
  envelopeId: z.string(),
});

export type TSendOwnerRecipientExpiredEmailJobDefinition = z.infer<
  typeof SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION = {
  id: SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Owner Recipient Expired Email',
  version: '1.0.0',
  trigger: {
    name: SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-owner-recipient-expired-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_OWNER_RECIPIENT_EXPIRED_EMAIL_JOB_DEFINITION_ID,
  TSendOwnerRecipientExpiredEmailJobDefinition
>;
