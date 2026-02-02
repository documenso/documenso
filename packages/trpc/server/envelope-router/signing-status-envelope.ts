import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { maybeAuthenticatedProcedure } from '../trpc';
import {
  ZSigningStatusEnvelopeRequestSchema,
  ZSigningStatusEnvelopeResponseSchema,
} from './signing-status-envelope.types';

// Internal route - not intended for public API usage
export const signingStatusEnvelopeRoute = maybeAuthenticatedProcedure
  .input(ZSigningStatusEnvelopeRequestSchema)
  .output(ZSigningStatusEnvelopeResponseSchema)
  .query(async ({ input, ctx }) => {
    const { token } = input;

    ctx.logger.info({
      input: {
        token,
      },
    });

    const envelope = await prisma.envelope.findFirst({
      where: {
        type: EnvelopeType.DOCUMENT,
        recipients: {
          some: {
            token,
          },
        },
      },
      include: {
        recipients: {
          select: {
            id: true,
            name: true,
            email: true,
            signingStatus: true,
            role: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    // Check if envelope is rejected
    if (envelope.status === DocumentStatus.REJECTED) {
      return {
        status: 'REJECTED',
      };
    }

    if (envelope.status === DocumentStatus.COMPLETED) {
      return {
        status: 'COMPLETED',
      };
    }

    const isComplete =
      envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
      envelope.recipients.every(
        (recipient) =>
          recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
      );

    if (isComplete) {
      return {
        status: 'PROCESSING',
      };
    }

    return {
      status: 'PENDING',
    };
  });
