import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_ID = 'send.direct.template.created.email';

const SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  teamId: z.number(),
  directRecipientId: z.number(),
});

export type TSendDirectTemplateCreatedEmailJobDefinition = z.infer<
  typeof SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION = {
  id: SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Direct Template Created Email',
  version: '1.0.0',
  trigger: {
    name: SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-direct-template-created-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_DIRECT_TEMPLATE_CREATED_EMAIL_JOB_DEFINITION_ID,
  TSendDirectTemplateCreatedEmailJobDefinition
>;
