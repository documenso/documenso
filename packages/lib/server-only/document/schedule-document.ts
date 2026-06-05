import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type ScheduleDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  /**
   * The time at which the draft envelope should be sent automatically.
   * Pass `null` to cancel an existing schedule and revert it to a normal draft.
   */
  scheduledAt: Date | null;
};

/**
 * Set (or clear) the scheduled send time on a draft envelope.
 *
 * The envelope stays in DRAFT until the scheduled-send sweep job picks it up and
 * dispatches it via `sendDocument`. Only draft envelopes can be scheduled, and the
 * target time must be in the future.
 */
export const scheduleDocument = async ({
  id,
  userId,
  teamId,
  scheduledAt,
}: ScheduleDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (envelope.status !== DocumentStatus.DRAFT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only draft documents can be scheduled.',
    });
  }

  if (scheduledAt !== null) {
    if (scheduledAt.getTime() <= Date.now()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'The scheduled send time must be in the future.',
      });
    }

    if (envelope.recipients.length === 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document has no recipients.',
      });
    }
  }

  return await prisma.envelope.update({
    where: {
      id: envelope.id,
    },
    data: {
      scheduledAt,
    },
    include: {
      documentMeta: true,
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
    },
  });
};
