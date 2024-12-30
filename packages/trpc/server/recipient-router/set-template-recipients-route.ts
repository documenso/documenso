import { z } from 'zod';

import { setRecipientsForTemplate } from '@documenso/lib/server-only/recipient/set-recipients-for-template';
import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { RecipientRole } from '@documenso/prisma/client';
import { RecipientSchema } from '@documenso/prisma/generated/zod';

import { authenticatedProcedure } from '../trpc';

export const ZSetTemplateRecipientRequestSchema = z
  .object({
    teamId: z.number().optional(),
    templateId: z.number(),
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

export const ZSetTemplateRecipientsResponseSchema = z.object({
  recipients: RecipientSchema.array(),
});

export const setTemplateRecipientsRoute = authenticatedProcedure
  .meta({
    openapi: {
      method: 'POST',
      path: '/template/{templateId}/recipient/set',
      summary: 'Set template recipients',
      description:
        'Replace the template recipients with the provided list of recipients. Recipients with the same ID will be updated and retain their fields. Recipients missing from the original template will be removed.',
      tags: ['Recipients'],
    },
  })
  .input(ZSetTemplateRecipientRequestSchema)
  .output(ZSetTemplateRecipientsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { templateId, signers, teamId } = input;

    return await setRecipientsForTemplate({
      userId: ctx.user.id,
      teamId,
      templateId,
      recipients: signers.map((signer) => ({
        id: signer.nativeId,
        email: signer.email,
        name: signer.name,
        role: signer.role,
        signingOrder: signer.signingOrder,
        actionAuth: signer.actionAuth,
      })),
    });
  });
