import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetEnvelopesByIdsRequestSchema,
  ZGetEnvelopesByIdsResponseSchema,
  getEnvelopesByIdsMeta,
} from './get-envelopes-by-ids.types';

export const getEnvelopesByIdsRoute = authenticatedProcedure
  .meta(getEnvelopesByIdsMeta)
  .input(ZGetEnvelopesByIdsRequestSchema)
  .output(ZGetEnvelopesByIdsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeIds } = input;

    ctx.logger.info({
      input: {
        envelopeIds,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeIds[0],
      },
      userId: user.id,
      teamId,
      type: null,
    });

    const envelopeOrInput = envelopeWhereInput.OR!;

    const envelopes = await prisma.envelope.findMany({
      where: {
        id: {
          in: envelopeIds,
        },
        OR: envelopeOrInput,
      },
      include: {
        envelopeItems: {
          include: {
            documentData: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        folder: true,
        documentMeta: true,
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
        fields: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
        directLink: {
          select: {
            directTemplateRecipientId: true,
            enabled: true,
            id: true,
            token: true,
          },
        },
      },
    });

    return envelopes.map((envelope) => ({
      ...envelope,
      user: {
        id: envelope.user.id,
        name: envelope.user.name || '',
        email: envelope.user.email,
      },
    }));
  });
