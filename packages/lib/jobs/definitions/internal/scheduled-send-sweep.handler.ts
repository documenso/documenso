import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { sendDocument } from '../../../server-only/document/send-document';
import type { JobRunIO } from '../../client/_internal/job';
import type { TScheduledSendSweepJobDefinition } from './scheduled-send-sweep';

export const run = async ({
  io,
}: {
  payload: TScheduledSendSweepJobDefinition;
  io: JobRunIO;
}) => {
  const now = new Date();

  const dueEnvelopes = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.DOCUMENT,
      status: DocumentStatus.DRAFT,
      deletedAt: null,
      scheduledAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      userId: true,
      teamId: true,
    },
    take: 100, // Limit per run to avoid long-running jobs; the rest are picked up next minute.
  });

  if (dueEnvelopes.length === 0) {
    io.logger.info('No scheduled envelopes due for sending');
    return;
  }

  io.logger.info(`Found ${dueEnvelopes.length} scheduled envelope(s) due for sending`);

  await Promise.allSettled(
    dueEnvelopes.map(async (envelope) => {
      // Atomically claim the envelope by clearing its schedule. If another worker
      // already claimed it (count !== 1), skip. Clearing first also guarantees that a
      // failing send won't be retried forever — it simply reverts to a normal draft.
      const claim = await prisma.envelope.updateMany({
        where: {
          id: envelope.id,
          status: DocumentStatus.DRAFT,
          scheduledAt: {
            lte: now,
          },
        },
        data: {
          scheduledAt: null,
        },
      });

      if (claim.count !== 1) {
        return;
      }

      try {
        await sendDocument({
          id: {
            type: 'envelopeId',
            id: envelope.id,
          },
          userId: envelope.userId,
          teamId: envelope.teamId,
          requestMetadata: {
            source: 'app',
            auth: null,
            requestMetadata: {},
          },
        });
      } catch (error) {
        io.logger.error(
          `Failed to send scheduled envelope ${envelope.id}; it has been reverted to a draft`,
        );
        io.logger.error(error instanceof Error ? error.message : String(error));
      }
    }),
  );
};
