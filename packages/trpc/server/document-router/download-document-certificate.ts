import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getCertificatePdf } from '@documenso/lib/server-only/htmltopdf/get-certificate-pdf';
import { isDocumentCompleted } from '@documenso/lib/utils/document';

import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadDocumentCertificateRequestSchema,
  ZDownloadDocumentCertificateResponseSchema,
} from './download-document-certificate.types';

export const downloadDocumentCertificateRoute = authenticatedProcedure
  .input(ZDownloadDocumentCertificateRequestSchema)
  .output(ZDownloadDocumentCertificateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const document = await getDocumentById({
      documentId,
      userId: user.id,
      teamId,
    });

    if (!document || (teamId && document.teamId !== teamId)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this document.',
      });
    }

    if (!isDocumentCompleted(document.status)) {
      throw new AppError('DOCUMENT_NOT_COMPLETE');
    }

    try {
      const pdfBuffer = await getCertificatePdf({
        documentId: document.id,
        language: document.documentMeta?.language,
      });

      const base64Pdf = pdfBuffer.toString('base64');
      const filename = `${document.title.replace(/\.pdf$/, '')}_certificate.pdf`;

      return {
        pdfData: base64Pdf,
        filename,
        contentType: 'application/pdf',
      };
    } catch (error) {
      ctx.logger.error({
        error,
        message: 'Failed to generate certificate PDF',
        documentId,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to generate certificate PDF',
      });
    }
  });
