import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createDocumentV2 } from '@documenso/lib/server-only/document/create-document-v2';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';

import { procedure } from '../trpc';
import {
  ZCreateEmbeddingDocumentRequestSchema,
  ZCreateEmbeddingDocumentResponseSchema,
} from './create-embedding-document.types';

export const createEmbeddingDocumentRoute = procedure
  .input(ZCreateEmbeddingDocumentRequestSchema)
  .output(ZCreateEmbeddingDocumentResponseSchema)
  .mutation(async ({ input, ctx: { req, metadata } }) => {
    try {
      const authorizationHeader = req.headers.get('authorization');

      const [presignToken] = (authorizationHeader || '')
        .split('Bearer ')
        .filter((s) => s.length > 0);

      if (!presignToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No presign token provided',
        });
      }

      const apiToken = await verifyEmbeddingPresignToken({ token: presignToken });

      const { title, documentDataId, externalId, recipients, meta } = input;

      const document = await createDocumentV2({
        data: {
          title,
          externalId,
          recipients,
        },
        meta,
        documentDataId,
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        requestMetadata: metadata,
      });

      if (!document.id) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to create document: missing document ID',
        });
      }

      return {
        documentId: document.id,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create document',
      });
    }
  });
