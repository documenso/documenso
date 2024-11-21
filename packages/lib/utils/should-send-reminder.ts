import { DateTime } from 'luxon';

import { ReminderInterval } from '@documenso/prisma/client';

export type ShouldSendReminderOptions = {
  reminderInterval: ReminderInterval;
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
    case ReminderInterval.EVERY_1_HOUR:
      return hoursSinceLastReminder >= 1;
    case ReminderInterval.EVERY_6_HOURS:
      return hoursSinceLastReminder >= 6;
    case ReminderInterval.EVERY_12_HOURS:
      return hoursSinceLastReminder >= 12;
    case ReminderInterval.DAILY:
      return hoursSinceLastReminder >= 24;
    case ReminderInterval.EVERY_3_DAYS:
      return hoursSinceLastReminder >= 72;
    case ReminderInterval.WEEKLY:
      return hoursSinceLastReminder >= 168;
    case ReminderInterval.EVERY_2_WEEKS:
      return hoursSinceLastReminder >= 336;
    case ReminderInterval.MONTHLY:
      return monthsSinceLastReminder >= 1;
    default:
      return false;
  }
};
