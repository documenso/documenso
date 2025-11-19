import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_ID = 'send.document.reminder.emails';

const SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_SCHEMA = z.object({
  documentId: z.number(),
  requestMetadata: z.any().optional(),
});

export type TSendDocumentReminderEmailsJobDefinition = z.infer<
  typeof SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_SCHEMA
>;

export const SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION = {
  id: SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_ID,
  name: 'Send Document Reminder Emails',
  version: '1.0.0',
  trigger: {
    name: SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_ID,
    schema: SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-document-reminder-email.handler');
    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_DOCUMENT_REMINDER_EMAILS_JOB_DEFINITION_ID,
  TSendDocumentReminderEmailsJobDefinition
>;
