import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { verifyEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { setTemplateRecipients } from '@documenso/lib/server-only/recipient/set-template-recipients';
import { updateTemplate } from '@documenso/lib/server-only/template/update-template';
import { nanoid } from '@documenso/lib/universal/id';

import { procedure } from '../trpc';
import {
  ZUpdateEmbeddingTemplateRequestSchema,
  ZUpdateEmbeddingTemplateResponseSchema,
} from './update-embedding-template.types';

export const updateEmbeddingTemplateRoute = procedure
  .input(ZUpdateEmbeddingTemplateRequestSchema)
  .output(ZUpdateEmbeddingTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
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

      const apiToken = await verifyEmbeddingPresignToken({ token: presignToken });

      const { templateId, title, externalId, recipients, meta } = input;

      await updateTemplate({
        templateId,
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        data: {
          title,
          externalId,
        },
        meta,
      });

      const recipientsWithClientId = recipients.map((recipient) => ({
        ...recipient,
        clientId: nanoid(),
      }));

      const { recipients: updatedRecipients } = await setTemplateRecipients({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        templateId,
        recipients: recipientsWithClientId.map((recipient) => ({
          id: recipient.id,
          email: recipient.email,
          name: recipient.name ?? '',
          role: recipient.role ?? 'SIGNER',
          signingOrder: recipient.signingOrder,
        })),
      });

      const fields = recipientsWithClientId.flatMap((recipient) => {
        const recipientId = updatedRecipients.find((r) => r.email === recipient.email)?.id;

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

      await setFieldsForTemplate({
        userId: apiToken.userId,
        teamId: apiToken.teamId ?? undefined,
        templateId,
        fields: fields.map((field) => ({
          ...field,
          pageWidth: field.width,
          pageHeight: field.height,
        })),
      });

      return {
        templateId,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to update template',
      });
    }
  });
