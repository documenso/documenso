import { DateTime } from 'luxon';

import { DocumentReminderInterval } from '@documenso/prisma/client';

export type ShouldSendReminderOptions = {
  reminderInterval: DocumentReminderInterval;
  lastReminderSentAt: Date | null;
  now: Date;
};

export const shouldSendReminder = ({
  lastReminderSentAt,
  now = new Date(),
  reminderInterval,
}: ShouldSendReminderOptions): boolean => {
  if (!lastReminderSentAt) {
    return true;
  }

  const hoursSinceLastReminder = DateTime.fromJSDate(now).diff(
    DateTime.fromJSDate(lastReminderSentAt),
    'hours',
  ).hours;
  const monthsSinceLastReminder = DateTime.fromJSDate(now).diff(
    DateTime.fromJSDate(lastReminderSentAt),
    'months',
  ).months;

  switch (reminderInterval) {
    case DocumentReminderInterval.EVERY_1_HOUR:
      return hoursSinceLastReminder >= 1;
    case DocumentReminderInterval.EVERY_6_HOURS:
      return hoursSinceLastReminder >= 6;
    case DocumentReminderInterval.EVERY_12_HOURS:
      return hoursSinceLastReminder >= 12;
    case DocumentReminderInterval.DAILY:
      return hoursSinceLastReminder >= 24;
    case DocumentReminderInterval.EVERY_3_DAYS:
      return hoursSinceLastReminder >= 72;
    case DocumentReminderInterval.WEEKLY:
      return hoursSinceLastReminder >= 168;
    case DocumentReminderInterval.EVERY_2_WEEKS:
      return hoursSinceLastReminder >= 336;
    case DocumentReminderInterval.MONTHLY:
      return monthsSinceLastReminder >= 1;
    default:
      return false;
  }
};
