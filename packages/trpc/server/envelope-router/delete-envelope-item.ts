import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteEnvelopeItemRequestSchema,
  ZDeleteEnvelopeItemResponseSchema,
} from './delete-envelope-item.types';

export const deleteEnvelopeItemRoute = authenticatedProcedure
  .input(ZDeleteEnvelopeItemRequestSchema)
  .output(ZDeleteEnvelopeItemResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, envelopeItemId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        envelopeItemId,
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

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: true,
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    const deletedEnvelopeItem = await prisma.envelopeItem.delete({
      where: {
        id: envelopeItemId,
        envelopeId: envelope.id,
      },
      select: {
        documentData: {
          select: {
            id: true,
          },
        },
      },
    });

    // Todo: Envelopes [ASK] - Should we delete the document data?
    await prisma.documentData.delete({
      where: {
        id: deletedEnvelopeItem.documentData.id,
        envelopeItem: {
          is: null,
        },
      },
    });

    // Todo: Envelope [AUDIT_LOGS]
  });
