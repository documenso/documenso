import { DocumentReminderInterval } from '@documenso/prisma/client';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_MONTHLY_REMINDER_EMAIL_JOB_ID = 'send.monthly.reminder.email';

export const SEND_MONTHLY_REMINDER_EMAIL_JOB = {
  id: SEND_MONTHLY_REMINDER_EMAIL_JOB_ID,
  name: 'Send Monthly Reminder Email',
  version: '1.0.0',
  trigger: {
    type: 'cron',
    schedule: '0 0 1 * *',
    name: SEND_MONTHLY_REMINDER_EMAIL_JOB_ID,
  },
  handler: async ({ io }) => {
    const handler = await import('./send-reminder.handler');

    await handler.run({
      io,
      interval: DocumentReminderInterval.MONTHLY,
    });
  },
} as const satisfies JobDefinition<typeof SEND_MONTHLY_REMINDER_EMAIL_JOB_ID>;
