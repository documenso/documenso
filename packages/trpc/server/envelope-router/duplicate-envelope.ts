import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { duplicateDocument } from '@documenso/lib/server-only/document/duplicate-document-by-id';
import { duplicateTemplate } from '@documenso/lib/server-only/template/duplicate-template';

import { authenticatedProcedure } from '../trpc';
import {
  ZDuplicateEnvelopeRequestSchema,
  ZDuplicateEnvelopeResponseSchema,
} from './duplicate-envelope.types';

export const duplicateEnvelopeRoute = authenticatedProcedure
  .input(ZDuplicateEnvelopeRequestSchema)
  .output(ZDuplicateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, envelopeType } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        envelopeType,
      },
    });

    const { id } = await match(envelopeType)
      .with(EnvelopeType.DOCUMENT, async () =>
        duplicateDocument({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
        }),
      )
      .with(EnvelopeType.TEMPLATE, async () =>
        duplicateTemplate({
          userId: ctx.user.id,
          teamId,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
        }),
      )
      .exhaustive();

    return {
      duplicatedEnvelopeId: id,
    };
  });
