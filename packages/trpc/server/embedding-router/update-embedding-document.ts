import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { nanoid } from '@documenso/lib/universal/id';

import { procedure } from '../trpc';
import {
  ZUpdateEmbeddingDocumentRequestSchema,
  ZUpdateEmbeddingDocumentResponseSchema,
} from './update-embedding-document.types';

export const updateEmbeddingDocumentRoute = procedure
  .input(ZUpdateEmbeddingDocumentRequestSchema)
  .output(ZUpdateEmbeddingDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        documentId: input.documentId,
      },
    });

    try {
      const authorizationHeader = ctx.req.headers.get('authorization');

      const [presignToken] = (authorizationHeader || '')
        .split('Bearer ')
        .filter((s) => s.length > 0);

      if (!presignToken) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'No presign token provided',
        });
      }

      const apiToken = await verifyEmbeddingPresignToken({
        token: presignToken,
        scope: `documentId:${input.documentId}`,
      });

      const { documentId, title, externalId, recipients, meta } = input;

      await updateEnvelope({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'documentId',
          id: documentId,
        },
        data: {
          title,
          externalId,
        },
        meta,
        requestMetadata: ctx.metadata,
      });

      const recipientsWithClientId = recipients.map((recipient) => ({
        ...recipient,
        clientId: nanoid(),
      }));

      const { recipients: updatedRecipients } = await setDocumentRecipients({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'documentId',
          id: documentId,
        },
        recipients: recipientsWithClientId.map((recipient) => ({
          id: recipient.id,
          clientId: recipient.clientId,
          email: recipient.email,
          name: recipient.name ?? '',
          role: recipient.role,
          signingOrder: recipient.signingOrder,
        })),
        requestMetadata: ctx.metadata,
      });

      const fields = recipientsWithClientId.flatMap((recipient) => {
        const recipientId = updatedRecipients.find((r) => r.clientId === recipient.clientId)?.id;

        if (!recipientId) {
          throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
            message: 'Recipient not found',
          });
        }

        return (recipient.fields ?? []).map((field) => ({
          ...field,
          recipientId,
          // !: Temp property to be removed once we don't link based on signer email
          signerEmail: recipient.email,
        }));
      });

      await setFieldsForDocument({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        id: {
          type: 'documentId',
          id: documentId,
        },
        fields: fields.map((field) => ({
          ...field,
          pageWidth: field.width,
          pageHeight: field.height,
        })),
        requestMetadata: ctx.metadata,
      });

      return {
        documentId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to update document',
      });
    }
  });
