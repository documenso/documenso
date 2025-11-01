import { createEnvelopeFields } from '@documenso/lib/server-only/field/create-envelope-fields';

import { authenticatedProcedure } from '../../trpc';
import {
  ZCreateEnvelopeFieldsRequestSchema,
  ZCreateEnvelopeFieldsResponseSchema,
} from './create-envelope-fields.types';

export const createEnvelopeFieldsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/field/create-many',
      summary: 'Create envelope fields',
      description: 'Create multiple fields for an envelope',
      tags: ['Envelope Fields'],
    },
  })
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

    return await createEnvelopeFields({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      fields,
      requestMetadata: metadata,
    });
  });
