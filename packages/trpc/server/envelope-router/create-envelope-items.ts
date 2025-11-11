import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prefixedId } from '@documenso/lib/universal/id';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateEnvelopeItemsRequestSchema,
  ZCreateEnvelopeItemsResponseSchema,
  createEnvelopeItemsMeta,
} from './create-envelope-items.types';

export const createEnvelopeItemsRoute = authenticatedProcedure
  .meta(createEnvelopeItemsMeta)
  .input(ZCreateEnvelopeItemsRequestSchema)
  .output(ZCreateEnvelopeItemsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { payload, files } = input;
    const { envelopeId } = payload;

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
        envelopeItems: {
          orderBy: {
            order: 'asc',
          },
        },
        team: {
          select: {
            organisation: {
              select: {
                organisationClaim: true,
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

    if (!canEnvelopeItemsBeModified(envelope, envelope.recipients)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    const organisationClaim = envelope.team.organisation.organisationClaim;

    const remainingEnvelopeItems =
      organisationClaim.envelopeItemCount - envelope.envelopeItems.length - files.length;

    if (remainingEnvelopeItems < 0) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${organisationClaim.envelopeItemCount} envelope items`,
        statusCode: 400,
      });
    }

    // For each file, stream to s3 and create the document data.
    const envelopeItems = await Promise.all(
      files.map(async (file) => {
        const { id: documentDataId } = await putNormalizedPdfFileServerSide(file);

        return {
          title: file.name,
          documentDataId,
        };
      }),
    );

    const currentHighestOrderValue =
      envelope.envelopeItems[envelope.envelopeItems.length - 1]?.order ?? 1;

    const result = await prisma.$transaction(async (tx) => {
      const createdItems = await tx.envelopeItem.createManyAndReturn({
        data: envelopeItems.map((item) => ({
          id: prefixedId('envelope_item'),
          envelopeId,
          title: item.title,
          documentDataId: item.documentDataId,
          order: currentHighestOrderValue + 1,
        })),
        include: {
          documentData: true,
        },
      });

      await tx.documentAuditLog.createMany({
        data: createdItems.map((item) =>
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_CREATED,
            envelopeId: envelope.id,
            data: {
              envelopeItemId: item.id,
              envelopeItemTitle: item.title,
            },
            user: {
              name: user.name,
              email: user.email,
            },
            requestMetadata: metadata.requestMetadata,
          }),
        ),
      });

      return createdItems;
    });

    return {
      data: result,
    };
  });
