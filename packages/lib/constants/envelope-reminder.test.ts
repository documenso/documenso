import { Duration } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ENVELOPE_REMINDER_SETTINGS,
  MAX_REMINDERS_BEFORE_RESEND,
  MAX_REMINDER_WINDOW_DAYS,
  deriveEffectiveReminderSettings,
  getEnvelopeReminderDuration,
  resolveNextReminderAt,
  type TEnvelopeReminderDurationPeriod,
  type TEnvelopeReminderSettings,
} from './envelope-reminder';

const ENABLED_SEND_AFTER: TEnvelopeReminderDurationPeriod = { unit: 'day', amount: 5 };
const ENABLED_REPEAT_EVERY: TEnvelopeReminderDurationPeriod = { unit: 'day', amount: 2 };

const ENABLED: TEnvelopeReminderSettings = {
  sendAfter: ENABLED_SEND_AFTER,
  repeatEvery: ENABLED_REPEAT_EVERY,
};

const DISABLED: TEnvelopeReminderSettings = {
  sendAfter: { disabled: true },
  repeatEvery: { disabled: true },
};

describe('deriveEffectiveReminderSettings', () => {
  it('uses the document override when present', () => {
    const doc: TEnvelopeReminderSettings = {
      sendAfter: { unit: 'week', amount: 1 },
      repeatEvery: { disabled: true },
    };

    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: doc,
      teamReminderSettings: ENABLED,
      organisationReminderSettings: ENABLED,
    });

    expect(result).toEqual(doc);
  });

  it('prefers document over team and organisation', () => {
    const doc: TEnvelopeReminderSettings = {
      sendAfter: { unit: 'day', amount: 1 },
      repeatEvery: { unit: 'day', amount: 1 },
    };

    const team: TEnvelopeReminderSettings = {
      sendAfter: { unit: 'day', amount: 9 },
      repeatEvery: { unit: 'day', amount: 9 },
    };

    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: doc,
      teamReminderSettings: team,
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(doc);
  });

  it('inherits the team setting when the document does not override', () => {
    const team: TEnvelopeReminderSettings = {
      sendAfter: { unit: 'week', amount: 2 },
      repeatEvery: { unit: 'day', amount: 3 },
    };

    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: null,
      teamReminderSettings: team,
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(team);
  });

  it('inherits the enabled organisation default when both document and team inherit', () => {
    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: null,
      teamReminderSettings: null,
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(DEFAULT_ENVELOPE_REMINDER_SETTINGS);
  });

  it('returns null (disabled) when every level inherits and org has no default', () => {
    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: null,
      teamReminderSettings: null,
      organisationReminderSettings: null,
    });

    expect(result).toBeNull();
  });

  it('treats explicitly disabled settings as a real override (does not fall through)', () => {
    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: DISABLED,
      teamReminderSettings: ENABLED,
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(DISABLED);
  });

  it('lets an explicitly disabled team setting cascade past an inheriting document', () => {
    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: null,
      teamReminderSettings: DISABLED,
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(DISABLED);
  });

  it('treats undefined and JSON-null markers as inherit, not as disabled', () => {
    // JSON columns may contain a JSON-null marker (e.g. Prisma.DbNull) which
    // is a non-null runtime value but does NOT match the settings schema. The
    // cascade must skip it and fall through to the organisation default.
    const jsonNullMarker = Object.create(null);

    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: undefined,
      teamReminderSettings: jsonNullMarker,
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(DEFAULT_ENVELOPE_REMINDER_SETTINGS);
  });

  it('ignores malformed values at a level and continues the cascade', () => {
    const result = deriveEffectiveReminderSettings({
      documentReminderSettings: { sendAfter: { disabled: true } }, // missing repeatEvery
      teamReminderSettings: 'not-an-object',
      organisationReminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    });

    expect(result).toEqual(DEFAULT_ENVELOPE_REMINDER_SETTINGS);
  });
});

describe('resolveNextReminderAt', () => {
  const sentAt = new Date('2026-01-01T00:00:00.000Z');

  it('returns null when config is null (no effective settings)', () => {
    expect(
      resolveNextReminderAt({
        config: null,
        sentAt,
        lastReminderSentAt: null,
        reminderCount: 0,
      }),
    ).toBeNull();
  });

  it('schedules the first reminder using sendAfter when nothing has been sent yet', () => {
    const result = resolveNextReminderAt({
      config: ENABLED,
      sentAt,
      lastReminderSentAt: null,
      reminderCount: 0,
    });

    const expected = new Date(sentAt.getTime() + getEnvelopeReminderDuration(ENABLED_SEND_AFTER).toMillis());

    expect(result).toEqual(expected);
  });

  it('returns null when the first reminder is explicitly disabled', () => {
    const result = resolveNextReminderAt({
      config: { sendAfter: { disabled: true }, repeatEvery: { unit: 'day', amount: 2 } },
      sentAt,
      lastReminderSentAt: null,
      reminderCount: 0,
    });

    expect(result).toBeNull();
  });

  it('schedules subsequent reminders using repeatEvery', () => {
    const lastReminderSentAt = new Date('2026-01-06T00:00:00.000Z');

    const result = resolveNextReminderAt({
      config: ENABLED,
      sentAt,
      lastReminderSentAt,
      reminderCount: 1,
    });

    const expected = new Date(
      lastReminderSentAt.getTime() + getEnvelopeReminderDuration(ENABLED_REPEAT_EVERY).toMillis(),
    );

    expect(result).toEqual(expected);
  });

  it('returns null when repeatEvery is explicitly disabled', () => {
    const lastReminderSentAt = new Date('2026-01-06T00:00:00.000Z');

    const result = resolveNextReminderAt({
      config: { sendAfter: { unit: 'day', amount: 5 }, repeatEvery: { disabled: true } },
      sentAt,
      lastReminderSentAt,
      reminderCount: 1,
    });

    expect(result).toBeNull();
  });

  it('stops scheduling after MAX_REMINDERS_BEFORE_RESEND reminders have been sent', () => {
    // After the 5th reminder, reminderCount is 5 — the 6th must not be scheduled.
    const lastReminderSentAt = new Date(
      sentAt.getTime() + Duration.fromObject({ days: 13 }).toMillis(),
    );

    const result = resolveNextReminderAt({
      config: ENABLED,
      sentAt,
      lastReminderSentAt,
      reminderCount: MAX_REMINDERS_BEFORE_RESEND,
    });

    expect(result).toBeNull();
  });

  it('still schedules the 5th reminder boundary (reminderCount < MAX)', () => {
    // reminderCount = 4 means 4 reminders already sent, scheduling the 5th.
    const lastReminderSentAt = new Date(
      sentAt.getTime() + Duration.fromObject({ days: 11 }).toMillis(),
    );

    const result = resolveNextReminderAt({
      config: ENABLED,
      sentAt,
      lastReminderSentAt,
      reminderCount: MAX_REMINDERS_BEFORE_RESEND - 1,
    });

    expect(result).not.toBeNull();
  });

  it('stops scheduling when the candidate falls outside the 30-day window', () => {
    // Configure a long repeat that would push past the 30-day cap.
    const config: TEnvelopeReminderSettings = {
      sendAfter: { unit: 'day', amount: 29 },
      repeatEvery: { unit: 'week', amount: 2 },
    };

    const firstReminder = resolveNextReminderAt({
      config,
      sentAt,
      lastReminderSentAt: null,
      reminderCount: 0,
    });

    expect(firstReminder).not.toBeNull();

    // Simulate having sent that first reminder; the repeat (2 weeks) is past day 30.
    const secondReminder = resolveNextReminderAt({
      config,
      sentAt,
      lastReminderSentAt: firstReminder,
      reminderCount: 1,
    });

    expect(secondReminder).toBeNull();
  });

  it('never schedules beyond MAX_REMINDER_WINDOW_DAYS from sentAt', () => {
    const config: TEnvelopeReminderSettings = {
      sendAfter: { unit: 'day', amount: MAX_REMINDER_WINDOW_DAYS + 1 },
      repeatEvery: { unit: 'day', amount: 1 },
    };

    const result = resolveNextReminderAt({
      config,
      sentAt,
      lastReminderSentAt: null,
      reminderCount: 0,
    });

    expect(result).toBeNull();
  });
});
