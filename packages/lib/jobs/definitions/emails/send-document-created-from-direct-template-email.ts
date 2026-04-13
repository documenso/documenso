import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_ID =
  'send.document.created.from.direct.template.email';

const SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  recipientId: z.number(),
});

export type TSendDocumentCreatedFromDirectTemplateEmailJobDefinition = z.infer<
  typeof SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION = {
  id: SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Document Created From Direct Template Email',
  version: '1.0.0',
  trigger: {
    name: SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-document-created-from-direct-template-email.handler');

    await handler.run({ payload });
  },
} as const satisfies JobDefinition<
  typeof SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_DOCUMENT_CREATED_FROM_DIRECT_TEMPLATE_EMAIL_JOB_DEFINITION_SCHEMA>
>;
