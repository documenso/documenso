import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_ID = 'send.document.super.delete.email';

const SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  documentTitle: z.string(),
  reason: z.string(),
  teamId: z.number(),
});

export type TSendDocumentSuperDeleteEmailJobDefinition = z.infer<
  typeof SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION = {
  id: SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Document Super Delete Email',
  version: '1.0.0',
  trigger: {
    name: SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-document-super-delete-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_DOCUMENT_SUPER_DELETE_EMAIL_JOB_DEFINITION_ID,
  TSendDocumentSuperDeleteEmailJobDefinition
>;
