import { EnvelopeType } from '@prisma/client';

import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';
import { mapDocumentIdToSecondaryId } from '@documenso/lib/utils/envelope';
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

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'documentId',
        id: documentIds[0],
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    const envelopeOrInput = envelopeWhereInput.OR!;

    const secondaryIds = documentIds.map((documentId) => mapDocumentIdToSecondaryId(documentId));

    const envelopes = await prisma.envelope.findMany({
      where: {
        type: EnvelopeType.DOCUMENT,
        secondaryId: {
          in: secondaryIds,
        },
        OR: envelopeOrInput,
      },
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

    return envelopes.map((envelope) => mapEnvelopesToDocumentMany(envelope));
  });
