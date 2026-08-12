import { authenticatedProcedure } from '../trpc';
import {
  downloadEnvelopeCertificatePdfMeta,
  ZDownloadEnvelopeCertificatePdfRequestSchema,
  ZDownloadEnvelopeCertificatePdfResponseSchema,
} from './download-envelope-certificate-pdf.types';

export const downloadEnvelopeCertificatePdfRoute = authenticatedProcedure
  .meta(downloadEnvelopeCertificatePdfMeta)
  .input(ZDownloadEnvelopeCertificatePdfRequestSchema)
  .output(ZDownloadEnvelopeCertificatePdfResponseSchema)
  .query(({ input, ctx }) => {
    const { envelopeId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    // This endpoint is purely for V2 API, which is implemented in the Hono remix server.
    throw new Error('NOT_IMPLEMENTED');
  });
