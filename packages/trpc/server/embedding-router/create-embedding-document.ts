import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

import { procedure } from '../trpc';
import {
  ZCreateEmbeddingDocumentRequestSchema,
  ZCreateEmbeddingDocumentResponseSchema,
} from './create-embedding-document.types';

// Todo: Envelopes - This only supports V1 documents/templates.
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

      const envelope = await createEnvelope({
        internalVersion: 1,
        data: {
          type: EnvelopeType.DOCUMENT,
          title,
          externalId,
          recipients: (recipients || []).map((recipient) => ({
            ...recipient,
            fields: (recipient.fields || []).map((field) => ({
              ...field,
              page: field.pageNumber,
              positionX: field.pageX,
              positionY: field.pageY,
              documentDataId,
            })),
          })),
          envelopeItems: [
            {
              documentDataId,
            },
          ],
        },
        meta,
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        requestMetadata: metadata,
      });

      if (!envelope.id) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to create document: missing document ID',
        });
      }

      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      return {
        documentId: legacyDocumentId,
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
