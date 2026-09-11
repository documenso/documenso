import { authenticatedProcedure } from '../trpc';
import {
  downloadEnvelopeAuditLogPdfMeta,
  ZDownloadEnvelopeAuditLogPdfRequestSchema,
  ZDownloadEnvelopeAuditLogPdfResponseSchema,
} from './download-envelope-audit-log-pdf.types';

export const downloadEnvelopeAuditLogPdfRoute = authenticatedProcedure
  .meta(downloadEnvelopeAuditLogPdfMeta)
  .input(ZDownloadEnvelopeAuditLogPdfRequestSchema)
  .output(ZDownloadEnvelopeAuditLogPdfResponseSchema)
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
