import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadEnvelopeItemRequestSchema,
  ZDownloadEnvelopeItemResponseSchema,
  downloadEnvelopeItemMeta,
} from './download-envelope-item.types';

export const downloadEnvelopeItemRoute = authenticatedProcedure
  .meta(downloadEnvelopeItemMeta)
  .input(ZDownloadEnvelopeItemRequestSchema)
  .output(ZDownloadEnvelopeItemResponseSchema)
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
