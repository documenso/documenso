import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  downloadEnvelopeItemMeta,
  ZDownloadEnvelopeItemRequestSchema,
  ZDownloadEnvelopeItemResponseSchema,
} from './download-envelope-item.types';

export const downloadEnvelopeItemRoute = authenticatedProcedure
  .meta(downloadEnvelopeItemMeta)
  .input(ZDownloadEnvelopeItemRequestSchema)
  .output(ZDownloadEnvelopeItemResponseSchema)
  .use(twoFactorScope((input) => ({ envelopeItem: input.envelopeItemId })))
  .query(({ input, ctx }) => {
    const { envelopeItemId, version } = input;

    ctx.logger.info({
      input: {
        envelopeItemId,
        version,
      },
    });

    // This endpoint is purely for V2 API, which is implemented in the Hono remix server.
    throw new Error('NOT_IMPLEMENTED');
  });
