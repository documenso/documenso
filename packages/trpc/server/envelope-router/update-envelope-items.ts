import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateEnvelopeItemsRequestSchema,
  ZUpdateEnvelopeItemsResponseSchema,
  updateEnvelopeItemsMeta,
} from './update-envelope-items.types';

export const updateEnvelopeItemsRoute = authenticatedProcedure
  .meta(updateEnvelopeItemsMeta)
  .input(ZUpdateEnvelopeItemsRequestSchema)
  .output(ZUpdateEnvelopeItemsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, data } = input;

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

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: true,
        envelopeItems: true,
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (data.length === 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Envelope items are required',
      });
    }

    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    // Check that the items belong to the envelope.
    const itemsBelongToEnvelope = data.every((item) =>
      envelope.envelopeItems.some(({ id }) => item.envelopeItemId === id),
    );

    if (!itemsBelongToEnvelope) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'One or more envelope items to update do not exist',
      });
    }

    const updatedEnvelopeItems = await Promise.all(
      data.map(async ({ envelopeItemId, order, title }) =>
        prisma.envelopeItem.update({
          where: {
            envelopeId: envelope.id,
            id: envelopeItemId,
          },
          data: {
            order,
            title,
          },
          select: {
            id: true,
            order: true,
            title: true,
            envelopeId: true,
          },
        }),
      ),
    );

    // Todo: Envelope [AUDIT_LOGS]

    return {
      data: updatedEnvelopeItems,
    };
  });
