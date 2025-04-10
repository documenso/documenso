import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZCreateEmbeddingTemplateRequestSchema,
  ZCreateEmbeddingTemplateResponseSchema,
} from './create-embedding-template.types';

export const createEmbeddingTemplateRoute = procedure
  .input(ZCreateEmbeddingTemplateRequestSchema)
  .output(ZCreateEmbeddingTemplateResponseSchema)
  .mutation(async ({ input, ctx: { req } }) => {
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
      const template = await createTemplate({
        userId: apiToken.userId,
        title,
        templateDocumentDataId: documentDataId,
        teamId: apiToken.teamId ?? undefined,
      });

      await Promise.all(
        recipients.map(async (recipient) => {
          const createdRecipient = await prisma.recipient.create({
            data: {
              templateId: template.id,
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
              recipientId: createdRecipient.id,
              type: field.type,
              page: field.pageNumber,
              positionX: field.pageX,
              positionY: field.pageY,
              width: field.width,
              height: field.height,
              customText: '',
              inserted: false,
              templateId: template.id,
            })),
          });

          return {
            ...createdRecipient,
            fields: createdFields,
          };
        }),
      );

      // Update the template meta if needed
      if (meta) {
        await prisma.templateMeta.upsert({
          where: {
            templateId: template.id,
          },
          create: {
            templateId: template.id,
            ...meta,
          },
          update: {
            ...meta,
          },
        });
      }

      if (!template.id) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Failed to create template: missing template ID',
        });
      }

      return {
        templateId: template.id,
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
