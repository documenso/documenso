import { DocumentReminderInterval } from '@documenso/prisma/client';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_HOURLY_REMINDER_EMAIL_JOB_ID = 'send.hourly.reminder.email';

export const SEND_HOURLY_REMINDER_EMAIL_JOB = {
  id: SEND_HOURLY_REMINDER_EMAIL_JOB_ID,
  name: 'Send Hourly Reminder Email',
  version: '1.0.0',
  trigger: {
    type: 'cron',
    // schedule: '0 * * * *',
    schedule: '*/2 * * * *',
    name: SEND_HOURLY_REMINDER_EMAIL_JOB_ID,
  },
  handler: async ({ io }) => {
    const handler = await import('./send-reminder.handler');

    await handler.run({
      io,
      interval: DocumentReminderInterval.EVERY_1_HOUR,
    });
  },
} as const satisfies JobDefinition<typeof SEND_HOURLY_REMINDER_EMAIL_JOB_ID>;
