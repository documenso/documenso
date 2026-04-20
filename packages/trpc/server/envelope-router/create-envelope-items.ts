import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { UNSAFE_createEnvelopeItems } from '@documenso/lib/server-only/envelope-item/create-envelope-items';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
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

    const { canFileBeChanged } = getEnvelopeItemPermissions(envelope, envelope.recipients);

    if (!canFileBeChanged) {
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

    const result = await UNSAFE_createEnvelopeItems({
      files: files.map((file) => ({
        file,
      })),
      envelope,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      apiRequestMetadata: metadata,
    });

    return {
      data: result,
    };
  });
