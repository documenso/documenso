import { updateEnvelopeFields } from '@documenso/lib/server-only/field/update-envelope-fields';

import { authenticatedProcedure } from '../../trpc';
import {
  ZUpdateEnvelopeFieldsRequestSchema,
  ZUpdateEnvelopeFieldsResponseSchema,
} from './update-envelope-fields.types';

export const updateEnvelopeFieldsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/envelope/field/update-many',
      summary: 'Update envelope fields',
      description: 'Update multiple envelope fields for an envelope',
      tags: ['Envelope Fields'],
    },
  })
  .input(ZUpdateEnvelopeFieldsRequestSchema)
  .output(ZUpdateEnvelopeFieldsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { envelopeId, data: fields } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await updateEnvelopeFields({
      userId: user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      fields,
      requestMetadata: ctx.metadata,
    });
  });
