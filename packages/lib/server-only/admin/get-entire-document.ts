import type { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';

export type unsafeGetEntireEnvelopeOptions = {
  id: EnvelopeIdOptions;
  type: EnvelopeType;
};

/**
 * An unauthenticated function that returns the whole envelope
 */
export const unsafeGetEntireEnvelope = async ({ id, type }: unsafeGetEntireEnvelopeOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: unsafeBuildEnvelopeIdQuery(id, type),
    include: {
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
        include: {
          fields: {
            include: {
              signature: true,
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  return envelope;
};
