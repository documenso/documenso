import type { DurationLikeObject } from 'luxon';
import { Duration } from 'luxon';
import { z } from 'zod';

export const ZEnvelopeExpirationDurationPeriod = z.object({
  unit: z.enum(['day', 'week', 'month', 'year']),
  amount: z.number().int().min(1),
});

export const ZEnvelopeExpirationDisabledPeriod = z.object({
  disabled: z.literal(true),
});

export const ZEnvelopeExpirationPeriod = z.union([
  ZEnvelopeExpirationDurationPeriod,
  ZEnvelopeExpirationDisabledPeriod,
]);

export type TEnvelopeExpirationPeriod = z.infer<typeof ZEnvelopeExpirationPeriod>;
export type TEnvelopeExpirationDurationPeriod = z.infer<typeof ZEnvelopeExpirationDurationPeriod>;

const UNIT_TO_LUXON_KEY: Record<
  TEnvelopeExpirationDurationPeriod['unit'],
  keyof DurationLikeObject
> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  year: 'years',
};

export const DEFAULT_ENVELOPE_EXPIRATION_PERIOD: TEnvelopeExpirationDurationPeriod = {
  unit: 'month',
  amount: 3,
};

export const getEnvelopeExpirationDuration = (
  period: TEnvelopeExpirationDurationPeriod,
): Duration => {
  return Duration.fromObject({ [UNIT_TO_LUXON_KEY[period.unit]]: period.amount });
};

/**
 * Resolve the concrete expiresAt timestamp from a raw expiration period (from JSON column).
 *
 * - `null` means use the default period (3 months).
 * - `{ disabled: true }` means never expires (returns null).
 * - `{ unit, amount }` means compute the timestamp from now + duration.
 */
export const resolveExpiresAt = (rawPeriod: unknown): Date | null => {
  if (rawPeriod === null || rawPeriod === undefined) {
    const duration = getEnvelopeExpirationDuration(DEFAULT_ENVELOPE_EXPIRATION_PERIOD);

    return new Date(Date.now() + duration.toMillis());
  }

  const parsed = ZEnvelopeExpirationPeriod.parse(rawPeriod);

  if ('disabled' in parsed) {
    return null;
  }

  const duration = getEnvelopeExpirationDuration(parsed);

  return new Date(Date.now() + duration.toMillis());
};
