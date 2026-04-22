import type { DurationLikeObject } from 'luxon';
import { Duration } from 'luxon';
import { z } from 'zod';

export const ZEnvelopeReminderDurationPeriod = z.object({
  unit: z.enum(['day', 'week', 'month']),
  amount: z.number().int().min(1),
});

export const ZEnvelopeReminderDisabledPeriod = z.object({
  disabled: z.literal(true),
});

export const ZEnvelopeReminderPeriod = z.union([
  ZEnvelopeReminderDurationPeriod,
  ZEnvelopeReminderDisabledPeriod,
]);

export type TEnvelopeReminderPeriod = z.infer<typeof ZEnvelopeReminderPeriod>;
export type TEnvelopeReminderDurationPeriod = z.infer<typeof ZEnvelopeReminderDurationPeriod>;

export const ZEnvelopeReminderSettings = z.object({
  sendAfter: ZEnvelopeReminderPeriod,
  repeatEvery: ZEnvelopeReminderPeriod,
});

export type TEnvelopeReminderSettings = z.infer<typeof ZEnvelopeReminderSettings>;

export const DEFAULT_ENVELOPE_REMINDER_SETTINGS: TEnvelopeReminderSettings = {
  sendAfter: { unit: 'day', amount: 5 },
  repeatEvery: { unit: 'day', amount: 2 },
};

const UNIT_TO_LUXON_KEY: Record<TEnvelopeReminderDurationPeriod['unit'], keyof DurationLikeObject> =
  {
    day: 'days',
    week: 'weeks',
    month: 'months',
  };

export const getEnvelopeReminderDuration = (period: TEnvelopeReminderDurationPeriod): Duration => {
  return Duration.fromObject({ [UNIT_TO_LUXON_KEY[period.unit]]: period.amount });
};

/**
 * Resolve the next reminder timestamp from the config and the last reminder sent time.
 *
 * - `null` config means reminders are disabled (inherit = no override, resolved as disabled).
 * - `{ sendAfter: { disabled: true }, ... }` means never send the first reminder.
 * - `{ repeatEvery: { disabled: true }, ... }` means don't repeat after the first reminder.
 *
 * `sentAt` is when the signing request was sent to this specific recipient.
 *
 * Returns the next Date the reminder should be sent, or null if no reminder should be sent.
 */
export const resolveNextReminderAt = (options: {
  config: TEnvelopeReminderSettings | null;
  sentAt: Date;
  lastReminderSentAt: Date | null;
}): Date | null => {
  const { config, sentAt, lastReminderSentAt } = options;

  if (!config) {
    return null;
  }

  // If we haven't sent the first reminder yet, use sendAfter.
  if (!lastReminderSentAt) {
    if ('disabled' in config.sendAfter) {
      return null;
    }

    const delay = getEnvelopeReminderDuration(config.sendAfter);

    return new Date(sentAt.getTime() + delay.toMillis());
  }

  // For subsequent reminders, use repeatEvery.
  if ('disabled' in config.repeatEvery) {
    return null;
  }

  const interval = getEnvelopeReminderDuration(config.repeatEvery);

  return new Date(lastReminderSentAt.getTime() + interval.toMillis());
};
