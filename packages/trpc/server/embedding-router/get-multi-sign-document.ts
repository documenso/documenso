import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { viewedDocument } from '@documenso/lib/server-only/document/viewed-document';
import { getCompletedFieldsForToken } from '@documenso/lib/server-only/field/get-completed-fields-for-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';

import { procedure } from '../trpc';
import {
  ZGetMultiSignDocumentRequestSchema,
  ZGetMultiSignDocumentResponseSchema,
} from './get-multi-sign-document.types';

export const getMultiSignDocumentRoute = procedure
  .input(ZGetMultiSignDocumentRequestSchema)
  .output(ZGetMultiSignDocumentResponseSchema)
  .query(async ({ input, ctx: { metadata } }) => {
    try {
      const { token } = input;

      const [document, fields, recipient] = await Promise.all([
        getDocumentAndSenderByToken({
          token,
          requireAccessAuth: false,
        }).catch(() => null),
        getFieldsForToken({ token }),
        getRecipientByToken({ token }).catch(() => null),
        getCompletedFieldsForToken({ token }).catch(() => []),
      ]);

      if (!document || !recipient) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Document or recipient not found',
        });
      }

      await viewedDocument({
        token,
        requestMetadata: metadata.requestMetadata,
      });

      // Transform fields to match our schema
      const transformedFields = fields.map((field) => ({
        ...field,
        recipient: {
          ...recipient,
          documentId: document.id,
          templateId: null,
        },
        documentId: document.id,
        templateId: null,
      }));

      return {
        ...document,
        folder: null,
        fields: transformedFields,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to get document details',
      });
    }
  });
