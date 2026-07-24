import { prisma } from '@documenso/prisma';
import { RecipientRole, SendStatus, SigningStatus } from '@prisma/client';

import { resolveNextReminderAt, type TEnvelopeReminderSettings } from '../../constants/envelope-reminder';
import { resolveEnvelopeReminderSettings } from './resolve-envelope-reminder-settings';

/**
 * Compute and store `nextReminderAt` for a single recipient.
 *
 * The effective reminder settings are resolved through the
 * Document -> Team -> Organisation cascade via `resolveEnvelopeReminderSettings`
 * so that a document whose settings are "inherit" (i.e. `null` at the document
 * level) still picks up the team/organisation default.
 *
 * Pass `resetReminderCount: true` to restart the reminder cycle (e.g. on a
 * manual resend): the count is zeroed and the schedule recomputed as if the
 * request was freshly sent at `sentAt`.
 *
 * Callers may pass an explicit `reminderSettings` override (already parsed) to
 * skip the cascade lookup; otherwise the envelope's effective settings are
 * fetched.
 */
export const updateRecipientNextReminder = async (options: {
  recipientId: number;
  envelopeId: string;
  sentAt: Date;
  lastReminderSentAt: Date | null;
  reminderCount?: number;
  resetReminderCount?: boolean;
  reminderSettings?: TEnvelopeReminderSettings | null;
}) => {
  const { recipientId, envelopeId, sentAt, lastReminderSentAt, reminderCount = 0, resetReminderCount } = options;

  let settings = options.reminderSettings;

  if (settings === undefined) {
    settings = await resolveEnvelopeReminderSettings(envelopeId);
  }

  const nextReminderAt = resolveNextReminderAt({
    config: settings,
    sentAt,
    lastReminderSentAt,
    reminderCount: resetReminderCount ? 0 : reminderCount,
  });

  await prisma.recipient.update({
    where: { id: recipientId },
    data: {
      nextReminderAt,
      ...(resetReminderCount ? { reminderCount: 0 } : {}),
    },
  });
};

/**
 * Recompute `nextReminderAt` for all active (unsigned, sent) recipients
 * of a given envelope. Call when document-level reminder settings change so
 * that switching to/from "inherit" or editing an explicit schedule is
 * immediately reflected for every unsigned recipient.
 *
 * Recipients that must NOT be re-queued:
 *   - CC recipients
 *   - recipients not yet sent or already signed/declined
 *   - recipients whose signing deadline has passed
 *
 * Manually distributed envelopes (`DocumentDistributionMethod.NONE`) and
 * envelopes with no effective reminder config (inherit-without-default or
 * explicitly disabled) produce `nextReminderAt = null`, which the sweep job
 * treats as "no reminder scheduled".
 *
 * The 30-day window, `MAX_REMINDERS_BEFORE_RESEND` cap, and manual-resend
 * reset semantics are enforced inside `resolveNextReminderAt` /
 * `updateRecipientNextReminder` and are unchanged by this recompute.
 */
export const recomputeNextReminderForEnvelope = async (envelopeId: string) => {
  // `resolveEnvelopeReminderSettings` already returns `null` for manually
  // distributed envelopes and for inherit-with-no-default, which causes
  // `resolveNextReminderAt` to produce `null` and clear any previously
  // scheduled reminder for each active recipient below.
  const settings = await resolveEnvelopeReminderSettings(envelopeId);

  const now = new Date();

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId,
      signingStatus: SigningStatus.NOT_SIGNED,
      sendStatus: SendStatus.SENT,
      sentAt: { not: null },
      role: { not: RecipientRole.CC },
      // Don't reschedule reminders for recipients whose deadline has passed.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, sentAt: true, lastReminderSentAt: true, reminderCount: true },
  });

  await Promise.all(
    recipients.map(async (recipient) => {
      if (!recipient.sentAt) {
        return;
      }

      const nextReminderAt = resolveNextReminderAt({
        config: settings,
        sentAt: recipient.sentAt,
        lastReminderSentAt: recipient.lastReminderSentAt,
        reminderCount: recipient.reminderCount,
      });

      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { nextReminderAt },
      });
    }),
  );
};
