import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadDocumentRequestSchema,
  ZDownloadDocumentResponseSchema,
  downloadDocumentMeta,
} from './download-document.types';

export const downloadDocumentRoute = authenticatedProcedure
  .meta(downloadDocumentMeta)
  .input(ZDownloadDocumentRequestSchema)
  .output(ZDownloadDocumentResponseSchema)
  .query(({ input, ctx }) => {
    const { documentId, version } = input;

    ctx.logger.info({
      input: {
        documentId,
        version,
      },
    });

    // This endpoint is purely for V2 API, which is implemented in the Hono remix server.
    throw new Error('NOT_IMPLEMENTED');
  });
