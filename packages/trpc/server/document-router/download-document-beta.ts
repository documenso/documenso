import type { DocumentData } from '@prisma/client';
import { DocumentDataType, EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getPresignGetUrl } from '@documenso/lib/universal/upload/server-actions';
import { isDocumentCompleted } from '@documenso/lib/utils/document';

import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadDocumentRequestSchema,
  ZDownloadDocumentResponseSchema,
  downloadDocumentMeta,
} from './download-document-beta.types';

export const downloadDocumentBetaRoute = authenticatedProcedure
  .meta(downloadDocumentMeta)
  .input(ZDownloadDocumentRequestSchema)
  .output(ZDownloadDocumentResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentId, version } = input;

    ctx.logger.info({
      input: {
        documentId,
        version,
      },
    });

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId,
    });

    // This error is done AFTER the get envelope so we can test access controls without S3.
    if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document downloads are only available when S3 storage is configured.',
      });
    }

    const documentData: DocumentData | undefined = envelope.envelopeItems[0]?.documentData;

    if (envelope.envelopeItems.length !== 1 || !documentData) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'This endpoint only supports documents with a single item. Use envelopes API instead.',
      });
    }

    if (documentData.type !== DocumentDataType.S3_PATH) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not stored in S3 and cannot be downloaded via URL.',
      });
    }

    if (version === 'signed' && !isDocumentCompleted(envelope.status)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not completed yet.',
      });
    }

    try {
      const data =
        version === 'original' ? documentData.initialData || documentData.data : documentData.data;

      const { url } = await getPresignGetUrl(data);

      const baseTitle = envelope.title.replace(/\.pdf$/, '');
      const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';
      const filename = `${baseTitle}${suffix}`;

      return {
        downloadUrl: url,
        filename,
        contentType: 'application/pdf',
      };
    } catch (error) {
      ctx.logger.error({
        error,
        message: 'Failed to generate download URL',
        documentId,
        version,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to generate download URL',
      });
    }
  });
