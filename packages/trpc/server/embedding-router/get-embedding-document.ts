import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZGetEmbeddingDocumentRequestSchema,
  ZGetEmbeddingDocumentResponseSchema,
} from './get-embedding-document.types';

export const getEmbeddingDocumentRoute = procedure
  .input(ZGetEmbeddingDocumentRequestSchema)
  .output(ZGetEmbeddingDocumentResponseSchema)
  .query(async ({ input, ctx: { req } }) => {
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

      const { documentId } = input;

      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId: apiToken.userId,
          ...(apiToken.teamId ? { teamId: apiToken.teamId } : {}),
        },
        include: {
          documentData: true,
          recipients: true,
          fields: true,
        },
      });

      if (!document) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Document not found',
        });
      }

      return {
        document,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to get document',
      });
    }
  });
