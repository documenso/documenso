import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_ID = 'internal.process-recipient-expired';

const PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_SCHEMA = z.object({
  recipientId: z.number(),
});

export type TProcessRecipientExpiredJobDefinition = z.infer<
  typeof PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_SCHEMA
>;

export const PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION = {
  id: PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_ID,
  name: 'Process Recipient Expired',
  version: '1.0.0',
  trigger: {
    name: PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_ID,
    schema: PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./process-recipient-expired.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof PROCESS_RECIPIENT_EXPIRED_JOB_DEFINITION_ID,
  TProcessRecipientExpiredJobDefinition
>;
