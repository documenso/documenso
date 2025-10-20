import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteEnvelopeRequestSchema,
  ZDeleteEnvelopeResponseSchema,
} from './delete-envelope.types';

export const deleteEnvelopeRoute = authenticatedProcedure
  // .meta(deleteEnvelopeMeta)
  .input(ZDeleteEnvelopeRequestSchema)
  .output(ZDeleteEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, envelopeType } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    await match(envelopeType)
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
  });
