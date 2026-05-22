import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import type { JobDefinition } from '../../client/_internal/job';

const SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_ID = 'send.document.completed.emails';

const SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TSendDocumentCompletedEmailsJobDefinition = z.infer<
  typeof SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_SCHEMA
>;

export const SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION = {
  id: SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_ID,
  name: 'Send Document Completed Emails',
  version: '1.0.0',
  trigger: {
    name: SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_ID,
    schema: SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-document-completed-emails.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_DOCUMENT_COMPLETED_EMAILS_JOB_DEFINITION_ID,
  TSendDocumentCompletedEmailsJobDefinition
>;
