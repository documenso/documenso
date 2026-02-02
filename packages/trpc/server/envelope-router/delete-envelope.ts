import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { prisma } from '@documenso/prisma';

import { ZGenericSuccessResponse } from '../schema';
import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteEnvelopeRequestSchema,
  ZDeleteEnvelopeResponseSchema,
  deleteEnvelopeMeta,
} from './delete-envelope.types';

export const deleteEnvelopeRoute = authenticatedProcedure
  .meta(deleteEnvelopeMeta)
  .input(ZDeleteEnvelopeRequestSchema)
  .output(ZDeleteEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const unsafeEnvelope = await prisma.envelope.findUnique({
      where: {
        id: envelopeId,
      },
      select: {
        type: true,
      },
    });

    if (!unsafeEnvelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    await match(unsafeEnvelope.type)
      .with(EnvelopeType.DOCUMENT, async () =>
        deleteDocument({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          requestMetadata: ctx.metadata,
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        deleteTemplate({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
        }),
      )
      .exhaustive();

    return ZGenericSuccessResponse;
  });
