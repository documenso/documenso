import { WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const EXECUTE_WEBHOOK_JOB_DEFINITION_ID = 'internal.execute-webhook';

const EXECUTE_WEBHOOK_JOB_DEFINITION_SCHEMA = z.object({
  event: z.nativeEnum(WebhookTriggerEvents),
  webhookId: z.string(),
  data: z.unknown(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TExecuteWebhookJobDefinition = z.infer<typeof EXECUTE_WEBHOOK_JOB_DEFINITION_SCHEMA>;

export const EXECUTE_WEBHOOK_JOB_DEFINITION = {
  id: EXECUTE_WEBHOOK_JOB_DEFINITION_ID,
  name: 'Execute Webhook',
  version: '1.0.0',
  trigger: {
    name: EXECUTE_WEBHOOK_JOB_DEFINITION_ID,
    schema: EXECUTE_WEBHOOK_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./execute-webhook.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof EXECUTE_WEBHOOK_JOB_DEFINITION_ID,
  TExecuteWebhookJobDefinition
>;
