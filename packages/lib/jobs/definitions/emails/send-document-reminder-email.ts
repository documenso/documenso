import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import type { JobDefinition } from '../../client/_internal/job';

const SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_ID = 'send.document.reminder.email';

const SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  envelopeId: z.string(),
  recipientId: z.number(),
  requestMetadata: ZRequestMetadataSchema.optional(),
  /**
   * The actor recorded on the EMAIL_SENT audit log. Mirrors the
   * `ApiRequestMetadata.auditUser` the inline resend used so the audit log is
   * identical (relevant for team API-key resends where the actor is the team).
   */
  auditUser: z
    .object({
      id: z.number().nullable(),
      email: z.string().nullable(),
      name: z.string().nullable(),
    })
    .optional(),
});

export type TSendDocumentReminderEmailJobDefinition = z.infer<
  typeof SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION = {
  id: SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Document Reminder Email',
  version: '1.0.0',
  trigger: {
    name: SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-document-reminder-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_DOCUMENT_REMINDER_EMAIL_JOB_DEFINITION_ID,
  TSendDocumentReminderEmailJobDefinition
>;
