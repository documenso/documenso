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

export const ZEnvelopeReminderPeriod = z.union([ZEnvelopeReminderDurationPeriod, ZEnvelopeReminderDisabledPeriod]);

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

/**
 * Hard upper bound on the window in which automated reminders may be sent,
 * measured from the moment the signing request was first sent to the
 * recipient. Prevents runaway reminder chains for recipients with no
 * expiration set who never sign.
 */
export const MAX_REMINDER_WINDOW_DAYS = 30;

/**
 * Maximum number of automated reminders sent to a recipient before reminders
 * stop. A manual resend resets the count, re-arming reminders.
 */
export const MAX_REMINDERS_BEFORE_RESEND = 5;

const UNIT_TO_LUXON_KEY: Record<TEnvelopeReminderDurationPeriod['unit'], keyof DurationLikeObject> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
};

export const getEnvelopeReminderDuration = (period: TEnvelopeReminderDurationPeriod): Duration => {
  return Duration.fromObject({ [UNIT_TO_LUXON_KEY[period.unit]]: period.amount });
};

/**
 * Parse a raw reminder-settings value (coming from a JSON column or an
 * incoming payload) into a concrete `TEnvelopeReminderSettings`.
 *
 * Returns `null` when the value is absent (`null`/`undefined`), a JSON null
 * marker (e.g. `Prisma.DbNull`) or does not match the schema. This lets the
 * cascade treat "no value" the same as "inherit from the next level up".
 */
const parseReminderSettings = (raw: unknown): TEnvelopeReminderSettings | null => {
  if (raw === null || raw === undefined) {
    return null;
  }

  const result = ZEnvelopeReminderSettings.safeParse(raw);

  return result.success ? result.data : null;
};

/**
 * Resolve the effective reminder settings that apply to an envelope, given
 * the raw values stored at each level of the cascade.
 *
 * The cascade is:
 *   1. Document-level override (when set)
 *   2. Team-level override (when set)
 *   3. Organisation-level default (when set)
 *   4. `null` (reminders disabled) when nothing is configured
 *
 * Each level may be:
 *   - a valid `TEnvelopeReminderSettings` object (enabled or explicitly disabled)
 *   - `null`/`undefined`/JSON-null (inherit from the level below)
 *
 * An explicitly disabled config (`{ sendAfter: { disabled: true }, repeatEvery:
 * { disabled: true } }`) is a real override — it stops the cascade and is
 * returned as-is so that `resolveNextReminderAt` honours the "no reminders"
 * semantics.
 *
 * The `disabled` flags inside an otherwise-enabled config (e.g. a first
 * reminder that is turned off) are NOT resolved here; `resolveNextReminderAt`
 * interprets them at scheduling time.
 *
 * NOTE: manual distribution (link sharing) is intentionally NOT handled here.
 * The server-side caller is responsible for returning `null` when the envelope
 * is distributed manually, because that gating is unrelated to the settings
 * cascade and differs per call site.
 */
export const deriveEffectiveReminderSettings = (options: {
  documentReminderSettings: unknown;
  teamReminderSettings: unknown;
  organisationReminderSettings: unknown;
}): TEnvelopeReminderSettings | null => {
  const document = parseReminderSettings(options.documentReminderSettings);

  if (document) {
    return document;
  }

  const team = parseReminderSettings(options.teamReminderSettings);

  if (team) {
    return team;
  }

  const organisation = parseReminderSettings(options.organisationReminderSettings);

  if (organisation) {
    return organisation;
  }

  return null;
};

/**
 * Resolve the next reminder timestamp from the config and the last reminder sent time.
 *
 * - `null` config means reminders are disabled (no override at any cascade level).
 * - `{ sendAfter: { disabled: true }, ... }` means never send the first reminder.
 * - `{ repeatEvery: { disabled: true }, ... }` means don't repeat after the first reminder.
 *
 * Reminders stop (returns null) once either cap is hit: `MAX_REMINDER_WINDOW_DAYS`
 * from `sentAt`, or `MAX_REMINDERS_BEFORE_RESEND` reminders already sent.
 *
 * `sentAt` is when the signing request was sent to this specific recipient.
 *
 * Returns the next Date the reminder should be sent, or null if none.
 */
export const resolveNextReminderAt = (options: {
  config: TEnvelopeReminderSettings | null;
  sentAt: Date;
  lastReminderSentAt: Date | null;
  reminderCount: number;
}): Date | null => {
  const { config, sentAt, lastReminderSentAt, reminderCount } = options;

  if (!config) {
    return null;
  }

  if (reminderCount >= MAX_REMINDERS_BEFORE_RESEND) {
    return null;
  }

  const maxReminderAt = new Date(sentAt.getTime() + Duration.fromObject({ days: MAX_REMINDER_WINDOW_DAYS }).toMillis());

  let candidate: Date;

  // If we haven't sent the first reminder yet, use sendAfter.
  if (!lastReminderSentAt) {
    if ('disabled' in config.sendAfter) {
      return null;
    }

    const delay = getEnvelopeReminderDuration(config.sendAfter);

    candidate = new Date(sentAt.getTime() + delay.toMillis());
  } else {
    // For subsequent reminders, use repeatEvery.
    if ('disabled' in config.repeatEvery) {
      return null;
    }

    const interval = getEnvelopeReminderDuration(config.repeatEvery);

    candidate = new Date(lastReminderSentAt.getTime() + interval.toMillis());
  }

  // Stop if the candidate is past the hard cap measured from sentAt.
  if (candidate.getTime() > maxReminderAt.getTime()) {
    return null;
  }

  return candidate;
};
