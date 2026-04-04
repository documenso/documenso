import { DocumentStatus, Prisma, RecipientRole, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import {
  ZEnvelopeReminderSettings,
  resolveNextReminderAt,
} from '../../../constants/envelope-reminder';
import { jobs } from '../../client';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningRemindersSweepJobDefinition } from './send-signing-reminders-sweep';

export const run = async ({
  io,
}: {
  payload: TSendSigningRemindersSweepJobDefinition;
  io: JobRunIO;
}) => {
  const now = new Date();

  // Find all envelopes that have a reminder config set and are still pending.
  const envelopes = await prisma.envelope.findMany({
    where: {
      status: DocumentStatus.PENDING,
      deletedAt: null,
      documentMeta: {
        reminderSettings: {
          not: Prisma.DbNull,
        },
      },
    },
    include: {
      documentMeta: true,
      recipients: {
        where: {
          signingStatus: SigningStatus.NOT_SIGNED,
          role: {
            not: RecipientRole.CC,
          },
        },
      },
    },
    take: 500,
  });

  const envelopesNeedingReminders = envelopes.filter((envelope) => {
    if (!envelope.documentMeta?.reminderSettings) {
      return false;
    }

    if (envelope.recipients.length === 0) {
      return false;
    }

    const parsed = ZEnvelopeReminderSettings.safeParse(envelope.documentMeta.reminderSettings);

    if (!parsed.success) {
      io.logger.warn(`Invalid reminderSettings for envelope ${envelope.id}`);
      return false;
    }

    const nextReminderAt = resolveNextReminderAt({
      config: parsed.data,
      envelopeSentAt: envelope.createdAt,
      lastReminderSentAt: envelope.documentMeta.lastReminderSentAt,
    });

    if (!nextReminderAt) {
      return false;
    }

    return nextReminderAt <= now;
  });

  if (envelopesNeedingReminders.length === 0) {
    io.logger.info('No envelopes need signing reminders');
    return;
  }

  io.logger.info(`Found ${envelopesNeedingReminders.length} envelopes needing signing reminders`);

  await Promise.allSettled(
    envelopesNeedingReminders.map(async (envelope) => {
      await jobs.triggerJob({
        name: 'internal.process-signing-reminder',
        payload: {
          envelopeId: envelope.id,
        },
      });
    }),
  );
};
