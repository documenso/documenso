import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { UNSAFE_replaceEnvelopeItemPdf } from '@documenso/lib/server-only/envelope-item/replace-envelope-item-pdf';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZReplaceEnvelopeItemPdfRequestSchema,
  ZReplaceEnvelopeItemPdfResponseSchema,
} from './replace-envelope-item-pdf.types';

/**
 * Keep this internal for the envelope editor.
 *
 * If we want to make this public then create a separate one that only allows
 * the PDF to be replaced & doesn't return deleted fields, etc.
 */
export const replaceEnvelopeItemPdfRoute = authenticatedProcedure
  .input(ZReplaceEnvelopeItemPdfRequestSchema)
  .output(ZReplaceEnvelopeItemPdfResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { payload, file } = input;
    const { envelopeId, envelopeItemId, title } = payload;

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
        envelopeItems: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'PDF replacement is only supported for version 2 envelopes',
      });
    }

    const { canFileBeChanged } = getEnvelopeItemPermissions(envelope, envelope.recipients);

    if (!canFileBeChanged) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    const envelopeItem = envelope.envelopeItems.find((item) => item.id === envelopeItemId);

    if (!envelopeItem) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope item not found',
      });
    }

    const { updatedItem, fields } = await UNSAFE_replaceEnvelopeItemPdf({
      envelope,
      recipients: envelope.recipients,
      envelopeItemId,
      oldDocumentDataId: envelopeItem.documentDataId,
      data: {
        file,
        title,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      apiRequestMetadata: metadata,
    });

    return {
      data: updatedItem,
      fields,
    };
  });
