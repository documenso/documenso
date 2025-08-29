import { DocumentDataType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getPresignGetUrl } from '@documenso/lib/universal/upload/server-actions';
import { isDocumentCompleted } from '@documenso/lib/utils/document';

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
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { documentId, version } = input;

    ctx.logger.info({
      input: {
        documentId,
        version,
      },
    });

    if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document downloads are only available when S3 storage is configured.',
      });
    }

    const document = await getDocumentById({
      documentId,
      userId: user.id,
      teamId,
    });

    if (!document.documentData) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document data not found',
      });
    }

    if (document.documentData.type !== DocumentDataType.S3_PATH) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not stored in S3 and cannot be downloaded via URL.',
      });
    }

    if (version === 'signed' && !isDocumentCompleted(document.status)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Document is not completed yet.',
      });
    }

    try {
      const documentData =
        version === 'original'
          ? document.documentData.initialData || document.documentData.data
          : document.documentData.data;

      const { url } = await getPresignGetUrl(documentData);

      const baseTitle = document.title.replace(/\.pdf$/, '');
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
