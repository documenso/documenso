import { DocumentReminderInterval } from '@documenso/prisma/client';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_DAILY_REMINDER_EMAIL_JOB_ID = 'send.daily.reminder.email';

export const SEND_DAILY_REMINDER_EMAIL_JOB = {
  id: SEND_DAILY_REMINDER_EMAIL_JOB_ID,
  name: 'Send Daily Reminder Email',
  version: '1.0.0',
  trigger: {
    type: 'cron',
    schedule: '0 0 * * *',
    name: SEND_DAILY_REMINDER_EMAIL_JOB_ID,
  },
  handler: async ({ io }) => {
    const handler = await import('./send-reminder.handler');

    await handler.run({
      io,
      intervals: [
        DocumentReminderInterval.DAILY,
        DocumentReminderInterval.EVERY_3_DAYS,
        DocumentReminderInterval.WEEKLY,
        DocumentReminderInterval.EVERY_2_WEEKS,
        DocumentReminderInterval.MONTHLY,
      ],
    });
  },
} as const satisfies JobDefinition<typeof SEND_DAILY_REMINDER_EMAIL_JOB_ID>;
