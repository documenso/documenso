import { updateEnvelopeFields } from '@documenso/lib/server-only/field/update-envelope-fields';

import { authenticatedProcedure } from '../../trpc';
import {
  ZUpdateEnvelopeFieldsRequestSchema,
  ZUpdateEnvelopeFieldsResponseSchema,
  updateEnvelopeFieldsMeta,
} from './update-envelope-fields.types';

export const updateEnvelopeFieldsRoute = authenticatedProcedure
  .meta(updateEnvelopeFieldsMeta)
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

    const { fields: data } = await updateEnvelopeFields({
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

    return {
      data,
    };
  });
