import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZCreateEmbeddingTemplateRequestSchema,
  ZCreateEmbeddingTemplateResponseSchema,
} from './create-embedding-template.types';

// Todo: Envelopes - This only supports V1 documents/templates.
export const createEmbeddingTemplateRoute = procedure
  .input(ZCreateEmbeddingTemplateRequestSchema)
  .output(ZCreateEmbeddingTemplateResponseSchema)
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

      const { title, documentDataId, recipients, meta } = input;

      // First create the template
      const template = await createEnvelope({
        internalVersion: 1,
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        data: {
          type: EnvelopeType.TEMPLATE,
          title,
          envelopeItems: [
            {
              documentDataId,
            },
          ],
        },
        meta,
        requestMetadata: metadata,
      });

      const firstEnvelopeItem = template.envelopeItems[0];

      await Promise.all(
        recipients.map(async (recipient) => {
          const createdRecipient = await prisma.recipient.create({
            data: {
              envelopeId: template.id,
              email: recipient.email,
              name: recipient.name || '',
              role: recipient.role || 'SIGNER',
              token: `template-${template.id}-${recipient.email}`,
              signingOrder: recipient.signingOrder,
            },
          });

          const fields = recipient.fields ?? [];

          const createdFields = await prisma.field.createMany({
            data: fields.map((field) => ({
              envelopeId: template.id,
              envelopeItemId: firstEnvelopeItem.id,
              recipientId: createdRecipient.id,
              type: field.type,
              page: field.pageNumber,
              positionX: field.pageX,
              positionY: field.pageY,
              width: field.width,
              height: field.height,
              customText: '',
              inserted: false,
            })),
          });

          return {
            ...createdRecipient,
            fields: createdFields,
          };
        }),
      );

      if (!template.id) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to create template: missing template ID',
        });
      }

      return {
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create template',
      });
    }
  });
