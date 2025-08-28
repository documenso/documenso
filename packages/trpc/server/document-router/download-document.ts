import type { DocumentData } from '@prisma/client';
import { DocumentDataType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
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
    const { documentId, version, documentDataId } = input;

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

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      userId: user.id,
      teamId,
    });

    let documentData: DocumentData | undefined = envelope.documents[0]?.documentData;

    if (documentDataId) {
      documentData = envelope.documents.find(
        (document) => document.documentData.id === documentDataId,
      )?.documentData;
    }

    if (!documentData) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document data not found',
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
      const { url } = await getPresignGetUrl(
        version === 'original' ? documentData.initialData || documentData.data : documentData.data,
      );

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
