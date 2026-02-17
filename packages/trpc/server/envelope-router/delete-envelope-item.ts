import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
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

    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
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

type UnsafeDeleteEnvelopeItemOptions = {
  envelopeId: string;
  envelopeItemId: string;
  user: {
    id: number;
    name: string | null;
    email: string;
  };
  apiRequestMetadata: ApiRequestMetadata;
};

export const UNSAFE_deleteEnvelopeItem = async ({
  envelopeId,
  envelopeItemId,
  user,
  apiRequestMetadata,
}: UnsafeDeleteEnvelopeItemOptions) => {
  const result = await prisma.$transaction(async (tx) => {
    const deletedEnvelopeItem = await tx.envelopeItem.delete({
      where: {
        id: envelopeItemId,
        envelopeId,
      },
      select: {
        id: true,
        title: true,
        documentData: {
          select: {
            id: true,
          },
        },
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_DELETED,
        envelopeId,
        data: {
          envelopeItemId: deletedEnvelopeItem.id,
          envelopeItemTitle: deletedEnvelopeItem.title,
        },
        user: {
          name: user.name,
          email: user.email,
        },
        requestMetadata: apiRequestMetadata.requestMetadata,
      }),
    });

    return deletedEnvelopeItem;
  });

  await prisma.documentData.delete({
    where: {
      id: result.documentData.id,
      envelopeItem: {
        is: null,
      },
    },
  });
};
