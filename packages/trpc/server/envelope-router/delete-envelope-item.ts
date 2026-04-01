import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { UNSAFE_deleteEnvelopeItem } from '@documenso/lib/server-only/envelope-item/delete-envelope-item';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { ZGenericSuccessResponse } from '../schema';
import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteEnvelopeItemRequestSchema,
  ZDeleteEnvelopeItemResponseSchema,
  deleteEnvelopeItemMeta,
} from './delete-envelope-item.types';

export const deleteEnvelopeItemRoute = authenticatedProcedure
  .meta(deleteEnvelopeItemMeta)
  .input(ZDeleteEnvelopeItemRequestSchema)
  .output(ZDeleteEnvelopeItemResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
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

    const { canFileBeChanged } = getEnvelopeItemPermissions(envelope, envelope.recipients);

    if (!canFileBeChanged) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    await UNSAFE_deleteEnvelopeItem({
      envelopeId,
      envelopeItemId,
      user,
      apiRequestMetadata: metadata,
    });

    return ZGenericSuccessResponse;
  });
