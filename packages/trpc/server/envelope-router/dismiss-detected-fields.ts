import { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDismissDetectedFieldsRequestSchema,
  ZDismissDetectedFieldsResponseSchema,
  dismissDetectedFieldsMeta,
} from './dismiss-detected-fields.types';

export const dismissDetectedFieldsRoute = authenticatedProcedure
  .meta(dismissDetectedFieldsMeta)
  .input(ZDismissDetectedFieldsRequestSchema)
  .output(ZDismissDetectedFieldsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, envelopeItemIds } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      select: { id: true },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    await prisma.envelopeItem.updateMany({
      where: {
        envelopeId: envelope.id,
        ...(envelopeItemIds ? { id: { in: envelopeItemIds } } : {}),
      },
      data: {
        detectedFields: Prisma.DbNull,
      },
    });

    return {
      success: true,
    };
  });
