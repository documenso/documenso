import { duplicateEnvelope } from '@documenso/lib/server-only/envelope/duplicate-envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZSaveAsTemplateRequestSchema,
  ZSaveAsTemplateResponseSchema,
} from './save-as-template.types';

export const saveAsTemplateRoute = authenticatedProcedure
  .input(ZSaveAsTemplateRequestSchema)
  .output(ZSaveAsTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { envelopeId, includeRecipients, includeFields } = input;
    const { teamId } = ctx;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const result = await duplicateEnvelope({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      overrides: {
        duplicateAsTemplate: true,
        includeRecipients,
        includeFields,
      },
    });

    return {
      id: result.id,
    };
  });
