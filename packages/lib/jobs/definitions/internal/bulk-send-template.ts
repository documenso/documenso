import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const BULK_SEND_TEMPLATE_JOB_DEFINITION_ID = 'internal.bulk-send-template';

const BULK_SEND_TEMPLATE_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  teamId: z.number(),
  templateId: z.number(),
  csvContent: z.string(),
  sendImmediately: z.boolean(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TBulkSendTemplateJobDefinition = z.infer<
  typeof BULK_SEND_TEMPLATE_JOB_DEFINITION_SCHEMA
>;

export const BULK_SEND_TEMPLATE_JOB_DEFINITION = {
  id: BULK_SEND_TEMPLATE_JOB_DEFINITION_ID,
  name: 'Bulk Send Template',
  version: '1.0.0',
  trigger: {
    name: BULK_SEND_TEMPLATE_JOB_DEFINITION_ID,
    schema: BULK_SEND_TEMPLATE_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./bulk-send-template.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof BULK_SEND_TEMPLATE_JOB_DEFINITION_ID,
  TBulkSendTemplateJobDefinition
>;
