import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_ID = 'send.admin.recipient.removed.emails';

const SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  recipientEmail: z.string(),
  recipientName: z.string(),
  /**
   * False when the recipient was never sent the document or is a CC.
   */
  notifyRecipient: z.boolean(),
});

export type TSendAdminRecipientRemovedEmailsJobDefinition = z.infer<
  typeof SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_SCHEMA
>;

export const SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION = {
  id: SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_ID,
  name: 'Send Admin Recipient Removed Emails',
  version: '1.0.0',
  trigger: {
    name: SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_ID,
    schema: SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-admin-recipient-removed-emails.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ADMIN_RECIPIENT_REMOVED_EMAILS_JOB_DEFINITION_ID,
  TSendAdminRecipientRemovedEmailsJobDefinition
>;
