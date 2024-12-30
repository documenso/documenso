import { z } from 'zod';

import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';
import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { RecipientRole } from '@documenso/prisma/client';
import { RecipientSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZSetDocumentRecipientsRequestSchema = z
  .object({
    documentId: z.number(),
    teamId: z.number().optional(),
    signers: z.array(
      z.object({
        nativeId: z.number().optional(),
        email: z.string().email().min(1),
        name: z.string(),
        role: z.nativeEnum(RecipientRole),
        signingOrder: z.number().optional(),
        actionAuth: ZRecipientActionAuthTypesSchema.optional().nullable(),
      }),
    ),
  })
  .refine(
    (schema) => {
      const emails = schema.signers.map((signer) => signer.email.toLowerCase());

      return new Set(emails).size === emails.length;
    },
    // Dirty hack to handle errors when .root is populated for an array type
    { message: 'Signers must have unique emails', path: ['signers__root'] },
  );

export const ZSetDocumentRecipientsResponseSchema = z.object({
  recipients: RecipientSchema.array(),
});

export const setDocumentRecipientsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/document/{documentId}/recipient/set',
      summary: 'Set document recipients',
      description:
        'Replace the document recipients with the provided list of recipients. Recipients with the same ID will be updated and retain their fields. Recipients missing from the original document will be removed.',
      tags: ['Recipients'],
    },
  })
  .input(ZSetDocumentRecipientsRequestSchema)
  .output(ZSetDocumentRecipientsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { documentId, teamId, signers } = input;

    return await setRecipientsForDocument({
      userId: ctx.user.id,
      documentId,
      teamId,
      recipients: signers.map((signer) => ({
        id: signer.nativeId,
        email: signer.email,
        name: signer.name,
        role: signer.role,
        signingOrder: signer.signingOrder,
        actionAuth: signer.actionAuth,
      })),
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  });
