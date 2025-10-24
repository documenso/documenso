import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { prefixedId } from '@documenso/lib/universal/id';
import { canEnvelopeItemsBeModified } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateEnvelopeItemsRequestSchema,
  ZCreateEnvelopeItemsResponseSchema,
} from './create-envelope-items.types';

export const createEnvelopeItemsRoute = authenticatedProcedure
  .input(ZCreateEnvelopeItemsRequestSchema)
  .output(ZCreateEnvelopeItemsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, items } = input;

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
      organisationClaim.envelopeItemCount - envelope.envelopeItems.length - items.length;

    if (remainingEnvelopeItems < 0) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${organisationClaim.envelopeItemCount} envelope items`,
        statusCode: 400,
      });
    }

    const foundDocumentData = await prisma.documentData.findMany({
      where: {
        id: {
          in: items.map((item) => item.documentDataId),
        },
      },
      select: {
        envelopeItem: {
          select: {
            id: true,
          },
        },
      },
    });

    // Check that all the document data was found.
    if (foundDocumentData.length !== items.length) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document data not found',
      });
    }

    // Check that it doesn't already have an envelope item.
    if (foundDocumentData.some((documentData) => documentData.envelopeItem?.id)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document data not found',
      });
    }

    const currentHighestOrderValue =
      envelope.envelopeItems[envelope.envelopeItems.length - 1]?.order ?? 1;

    const result = await prisma.envelopeItem.createManyAndReturn({
      data: items.map((item) => ({
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

    return {
      createdEnvelopeItems: result,
    };
  });
