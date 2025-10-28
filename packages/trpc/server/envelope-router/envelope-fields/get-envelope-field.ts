import { getFieldById } from '@documenso/lib/server-only/field/get-field-by-id';

import { authenticatedProcedure } from '../../trpc';
import {
  ZGetEnvelopeFieldRequestSchema,
  ZGetEnvelopeFieldResponseSchema,
} from './get-envelope-field.types';

export const getEnvelopeFieldRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/envelope/field/{fieldId}',
      summary: 'Get envelope field',
      description: 'Returns an envelope field given an ID',
      tags: ['Envelope Field'],
    },
  })
  .input(ZGetEnvelopeFieldRequestSchema)
  .output(ZGetEnvelopeFieldResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { fieldId } = input;

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    return await getFieldById({
      userId: user.id,
      teamId,
      fieldId,
    });
  });
