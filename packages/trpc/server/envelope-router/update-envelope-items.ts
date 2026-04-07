import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { UNSAFE_updateEnvelopeItems } from '@documenso/lib/server-only/envelope-item/update-envelope-items';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
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

    const permissions = getEnvelopeItemPermissions(envelope, envelope.recipients);

    const hasOrderChange = data.some((item) => {
      if (item.order === undefined) {
        return false;
      }

      const existingItem = envelope.envelopeItems.find((e) => e.id === item.envelopeItemId);

      return !existingItem || existingItem.order !== item.order;
    });

    const hasTitleChange = data.some((item) => item.title !== undefined);

    if (!hasTitleChange && !hasOrderChange) {
      return {
        data: envelope.envelopeItems.map((item) => ({
          id: item.id,
          order: item.order,
          title: item.title,
          envelopeId: item.envelopeId,
        })),
      };
    }

    if (hasTitleChange && !permissions.canTitleBeChanged) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item title is not editable',
      });
    }

    if (hasOrderChange && !permissions.canOrderBeChanged) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item order is not editable',
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

    const updatedEnvelopeItems = await UNSAFE_updateEnvelopeItems({
      envelopeId,
      envelopeType: envelope.type,
      existingEnvelopeItems: envelope.envelopeItems,
      data,
      user: {
        name: user.name,
        email: user.email,
      },
      apiRequestMetadata: ctx.metadata,
    });

    return {
      data: updatedEnvelopeItems,
    };
  });
