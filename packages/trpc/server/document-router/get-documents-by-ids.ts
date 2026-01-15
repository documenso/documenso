import { EnvelopeType } from '@prisma/client';

import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetDocumentsByIdsRequestSchema,
  ZGetDocumentsByIdsResponseSchema,
  getDocumentsByIdsMeta,
} from './get-documents-by-ids.types';

export const getDocumentsByIdsRoute = authenticatedProcedure
  .meta(getDocumentsByIdsMeta)
  .input(ZGetDocumentsByIdsRequestSchema)
  .output(ZGetDocumentsByIdsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentIds } = input;

    ctx.logger.info({
      input: {
        documentIds,
      },
    });

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'documentId',
        ids: documentIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        team: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    });

    return {
      data: envelopes.map((envelope) => mapEnvelopesToDocumentMany(envelope)),
    };
  });
