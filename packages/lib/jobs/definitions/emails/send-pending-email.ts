import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_PENDING_EMAIL_JOB_DEFINITION_ID = 'send.document.pending.email';

const SEND_PENDING_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  recipientId: z.number(),
});

export type TSendPendingEmailJobDefinition = z.infer<
  typeof SEND_PENDING_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_PENDING_EMAIL_JOB_DEFINITION = {
  id: SEND_PENDING_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Pending Email',
  version: '1.0.0',
  trigger: {
    name: SEND_PENDING_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_PENDING_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-pending-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_PENDING_EMAIL_JOB_DEFINITION_ID,
  TSendPendingEmailJobDefinition
>;
