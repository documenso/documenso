import { DocumentStatus, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

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

  const recipients = await prisma.recipient.findMany({
    where: {
      nextReminderAt: { lte: now },
      signingStatus: SigningStatus.NOT_SIGNED,
      sendStatus: SendStatus.SENT,
      role: { not: RecipientRole.CC },
      envelope: {
        status: DocumentStatus.PENDING,
        deletedAt: null,
      },
    },
    select: { id: true },
    take: 1000,
  });

  if (recipients.length === 0) {
    io.logger.info('No recipients need signing reminders');
    return;
  }

  io.logger.info(`Found ${recipients.length} recipients needing signing reminders`);

  await Promise.allSettled(
    recipients.map(async (recipient) => {
      await jobs.triggerJob({
        name: 'internal.process-signing-reminder',
        payload: {
          recipientId: recipient.id,
        },
      });
    }),
  );
};
