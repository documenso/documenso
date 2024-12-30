import { z } from 'zod';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError } from '@documenso/lib/errors/app-error';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { Document } from '@documenso/prisma/client';
import {
  DocumentDataSchema,
  DocumentMetaSchema,
  DocumentSchema,
  FieldSchema,
  RecipientSchema,
} from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZCreateDocumentFromTemplateRequestSchema = z.object({
  templateId: z.number(),
  teamId: z.number().optional(),
  recipients: z
    .array(
      z.object({
        id: z.number(),
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .refine((recipients) => {
      const emails = recipients.map((signer) => signer.email);
      return new Set(emails).size === emails.length;
    }, 'Recipients must have unique emails'),
  distributeDocument: z.boolean().optional(),
});

export const ZCreateDocumentFromTemplateResponseSchema = DocumentSchema.extend({
  documentData: DocumentDataSchema,
  documentMeta: DocumentMetaSchema.nullable(),
  Recipient: RecipientSchema.array(),
  Field: FieldSchema.array(),
});

export const createDocumentFromTemplateRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/use',
      summary: 'Use template',
      description: 'Use the template to create a document',
      tags: ['Template'],
    },
  })
  .input(ZCreateDocumentFromTemplateRequestSchema)
  .output(ZCreateDocumentFromTemplateResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, teamId, recipients, distributeDocument } = input;

    const limits = await getServerLimits({ email: ctx.user.email, teamId });

    if (limits.remaining.documents === 0) {
      throw new Error('You have reached your document limit.');
    }

    const requestMetadata = extractNextApiRequestMetadata(ctx.req);

    const document: Document = await createDocumentFromTemplate({
      templateId,
      teamId,
      userId: ctx.user.id,
      recipients,
      requestMetadata,
    });

    if (distributeDocument) {
      await sendDocument({
        documentId: document.id,
        userId: ctx.user.id,
        teamId,
        requestMetadata,
      }).catch((err) => {
        console.error(err);

        throw new AppError('DOCUMENT_SEND_FAILED');
      });
    }

    return getDocumentWithDetailsById({
      documentId: document.id,
      userId: ctx.user.id,
      teamId,
    });
  });
