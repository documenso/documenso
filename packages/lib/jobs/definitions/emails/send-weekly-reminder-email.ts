import { DocumentReminderInterval } from '@documenso/prisma/client';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_WEEKLY_REMINDER_EMAIL_JOB_ID = 'send.weekly.reminder.email';

export const SEND_WEEKLY_REMINDER_EMAIL_JOB = {
  id: SEND_WEEKLY_REMINDER_EMAIL_JOB_ID,
  name: 'Send Weekly Reminder Email',
  version: '1.0.0',
  trigger: {
    type: 'cron',
    schedule: '0 0 * * 0',
    name: SEND_WEEKLY_REMINDER_EMAIL_JOB_ID,
  },
  handler: async ({ io }) => {
    const handler = await import('./send-reminder.handler');

    await handler.run({
      io,
      interval: DocumentReminderInterval.WEEKLY,
    });
  },
} as const satisfies JobDefinition<typeof SEND_WEEKLY_REMINDER_EMAIL_JOB_ID>;
