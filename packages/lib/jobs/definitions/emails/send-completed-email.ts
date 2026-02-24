import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const SEND_COMPLETED_EMAIL_JOB_DEFINITION_ID = 'send.document.completed.email';

const SEND_COMPLETED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TSendCompletedEmailJobDefinition = z.infer<
  typeof SEND_COMPLETED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_COMPLETED_EMAIL_JOB_DEFINITION = {
  id: SEND_COMPLETED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Completed Email',
  version: '1.0.0',
  trigger: {
    name: SEND_COMPLETED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_COMPLETED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-completed-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_COMPLETED_EMAIL_JOB_DEFINITION_ID,
  TSendCompletedEmailJobDefinition
>;
