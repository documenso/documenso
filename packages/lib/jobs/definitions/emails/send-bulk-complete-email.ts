import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_ID = 'send.bulk.complete.email';

const SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  templateId: z.number(),
  templateName: z.string(),
  totalProcessed: z.number(),
  successCount: z.number(),
  failedCount: z.number(),
  errors: z.array(z.string()),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TSendBulkCompleteEmailJobDefinition = z.infer<
  typeof SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION = {
  id: SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Bulk Complete Email',
  version: '1.0.0',
  trigger: {
    name: SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-bulk-complete-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_BULK_COMPLETE_EMAIL_JOB_DEFINITION_ID,
  TSendBulkCompleteEmailJobDefinition
>;
