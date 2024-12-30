import { z } from 'zod';

import { createDocumentFromDirectTemplate } from '@documenso/lib/server-only/template/create-document-from-direct-template';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { ZSignFieldWithTokenMutationSchema } from '../field-router/schema';
import { maybeAuthenticatedProcedure } from '../trpc';

export const ZCreateDocumentFromTemplateRequestSchema = z.object({
  directRecipientName: z.string().optional(),
  directRecipientEmail: z.string().email(),
  directTemplateToken: z.string().min(1),
  directTemplateExternalId: z.string().optional(),
  signedFieldValues: z.array(ZSignFieldWithTokenMutationSchema),
  templateUpdatedAt: z.date(),
});

export const ZCreateDocumentFromTemplateResponseSchema = z.object({
  token: z.string(),
  documentId: z.number(),
  recipientId: z.number(),
});

export const createDocumentFromTemplateRoute = maybeAuthenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/use',
      summary: 'Use direct template',
      description: 'Use a direct template to create a document',
      tags: ['Template'],
    },
  })
  .input(ZCreateDocumentFromTemplateRequestSchema)
  .output(ZCreateDocumentFromTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const {
      directRecipientName,
      directRecipientEmail,
      directTemplateToken,
      directTemplateExternalId,
      signedFieldValues,
      templateUpdatedAt,
    } = input;

    const requestMetadata = extractNextApiRequestMetadata(ctx.req);

    return await createDocumentFromDirectTemplate({
      directRecipientName,
      directRecipientEmail,
      directTemplateToken,
      directTemplateExternalId,
      signedFieldValues,
      templateUpdatedAt,
      user: ctx.user
        ? {
            id: ctx.user.id,
            name: ctx.user.name || undefined,
            email: ctx.user.email,
          }
        : undefined,
      requestMetadata,
    });
  });
