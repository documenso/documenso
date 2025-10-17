import { FieldType, ReadStatus, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { signFieldWithToken } from '@documenso/lib/server-only/field/sign-field-with-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZApplyMultiSignSignatureRequestSchema,
  ZApplyMultiSignSignatureResponseSchema,
} from './apply-multi-sign-signature.types';

export const applyMultiSignSignatureRoute = procedure
  .input(ZApplyMultiSignSignatureRequestSchema)
  .output(ZApplyMultiSignSignatureResponseSchema)
  .mutation(async ({ input, ctx: { metadata } }) => {
    try {
      const { tokens, signature, isBase64 } = input;

      // Get all documents and recipients for the tokens
      const envelopes = await Promise.all(
        tokens.map(async (token) => {
          const document = await getDocumentByToken({ token });
          const recipient = await getRecipientByToken({ token });

          return { document, recipient };
        }),
      );

      // Check if all documents have been viewed
      const hasUnviewedDocuments = envelopes.some(
        (envelope) => envelope.recipient.readStatus !== ReadStatus.OPENED,
      );

      if (hasUnviewedDocuments) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'All documents must be viewed before signing',
        });
      }

      // If we require action auth we should abort here for now
      for (const envelope of envelopes) {
        const derivedRecipientActionAuth = extractDocumentAuthMethods({
          documentAuth: envelope.document.authOptions,
          recipientAuth: envelope.recipient.authOptions,
        });

        if (
          derivedRecipientActionAuth.recipientAccessAuthRequired ||
          derivedRecipientActionAuth.recipientActionAuthRequired
        ) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message:
              'Documents that require additional authentication cannot be multi signed at the moment',
          });
        }
      }

      // Sign all signature fields for each document
      await Promise.all(
        envelopes.map(async (envelope) => {
          if (envelope.recipient.signingStatus === SigningStatus.REJECTED) {
            return;
          }

          const signatureFields = await prisma.field.findMany({
            where: {
              envelopeId: envelope.document.id,
              recipientId: envelope.recipient.id,
              type: FieldType.SIGNATURE,
              inserted: false,
            },
          });

          await Promise.all(
            signatureFields.map(async (field) =>
              signFieldWithToken({
                token: envelope.recipient.token,
                fieldId: field.id,
                value: signature,
                isBase64,
                requestMetadata: metadata.requestMetadata,
              }),
            ),
          );
        }),
      );

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to apply multi-sign signature',
      });
    }
  });
