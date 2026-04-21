import {
  DocumentDistributionMethod,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';

import { prisma } from '@documenso/prisma';

import {
  ZEnvelopeReminderSettings,
  resolveNextReminderAt,
} from '../../constants/envelope-reminder';

/**
 * Compute and store `nextReminderAt` for a single recipient.
 *
 * Call this after:
 * - Sending the signing email (sentAt is set)
 * - Sending a reminder (lastReminderSentAt is updated)
 *
 * If `reminderSettings` is provided it's used directly, avoiding a query.
 * Otherwise it's read from the envelope's documentMeta (already resolved
 * from the org/team cascade at envelope creation time).
 */
export const updateRecipientNextReminder = async (options: {
  recipientId: number;
  envelopeId: string;
  sentAt: Date;
  lastReminderSentAt: Date | null;
  reminderSettings?: ReturnType<typeof ZEnvelopeReminderSettings.parse> | null;
}) => {
  const { recipientId, envelopeId, sentAt, lastReminderSentAt } = options;

  let settings = options.reminderSettings;

  if (settings === undefined) {
    const envelope = await prisma.envelope.findFirst({
      where: { id: envelopeId },
      select: { documentMeta: { select: { reminderSettings: true } } },
    });

    settings = envelope?.documentMeta?.reminderSettings
      ? ZEnvelopeReminderSettings.parse(envelope.documentMeta.reminderSettings)
      : null;
  }

  const nextReminderAt = resolveNextReminderAt({
    config: settings,
    sentAt,
    lastReminderSentAt,
  });

  await prisma.recipient.update({
    where: { id: recipientId },
    data: { nextReminderAt },
  });
};

/**
 * Recompute `nextReminderAt` for all active (unsigned, sent) recipients
 * of a given envelope. Call when document-level reminder settings change.
 */
export const recomputeNextReminderForEnvelope = async (envelopeId: string) => {
  const envelope = await prisma.envelope.findFirst({
    where: { id: envelopeId },
    select: {
      documentMeta: {
        select: { reminderSettings: true, distributionMethod: true },
      },
    },
  });

  // No reminders for manually distributed documents.
  const isEmailDistribution =
    envelope?.documentMeta?.distributionMethod !== DocumentDistributionMethod.NONE;

  const settings =
    isEmailDistribution && envelope?.documentMeta?.reminderSettings
      ? ZEnvelopeReminderSettings.parse(envelope.documentMeta.reminderSettings)
      : null;

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId,
      signingStatus: SigningStatus.NOT_SIGNED,
      sendStatus: SendStatus.SENT,
      sentAt: { not: null },
      role: { not: RecipientRole.CC },
    },
    select: { id: true, sentAt: true, lastReminderSentAt: true },
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
      });

      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { nextReminderAt },
      });
    }),
  );
};
