import { setEnvelopeContents } from '@documenso/lib/server-only/envelope-content/set-envelope-contents';

import { authenticatedProcedure } from '../trpc';
import { ZSetEnvelopeContentsRequestSchema, ZSetEnvelopeContentsResponseSchema } from './set-envelope-contents.types';

// Note: This is intended to always be an internal route.
export const setEnvelopeContentsRoute = authenticatedProcedure
  .input(ZSetEnvelopeContentsRequestSchema)
  .output(ZSetEnvelopeContentsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, contents } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const result = await setEnvelopeContents({
      userId: ctx.user.id,
      teamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      contents,
      requestMetadata: ctx.metadata,
    });

    return {
      data: result.contents,
    };
  });
