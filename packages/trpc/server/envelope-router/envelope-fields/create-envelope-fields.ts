import { createEnvelopeFields } from '@documenso/lib/server-only/field/create-envelope-fields';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateEnvelopeFieldsRequestSchema,
  ZCreateEnvelopeFieldsResponseSchema,
  createEnvelopeFieldsMeta,
} from './create-envelope-fields.types';

export const createEnvelopeFieldsRoute = authenticatedProcedure
  .meta(createEnvelopeFieldsMeta)
  .input(ZCreateEnvelopeFieldsRequestSchema)
  .output(ZCreateEnvelopeFieldsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { envelopeId, data: fields } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { fields: data } = await createEnvelopeFields({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      fields,
      requestMetadata: metadata,
    });

    return {
      data,
    };
  });
