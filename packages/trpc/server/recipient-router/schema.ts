import { z } from 'zod';

import { RecipientRole } from '@documenso/prisma/client';

export const ZAddSignersMutationSchema = z
  .object({
    documentId: z.number(),
    teamId: z.number().optional(),
    signers: z.array(
      z.object({
        nativeId: z.number().optional(),
        email: z.string().email().min(1),
        name: z.string(),
        role: z.nativeEnum(RecipientRole),
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

export type TAddSignersMutationSchema = z.infer<typeof ZAddSignersMutationSchema>;

export const ZAddTemplateSignersMutationSchema = z
  .object({
    templateId: z.number(),
    signers: z.array(
      z.object({
        nativeId: z.number().optional(),
        email: z.string().email().min(1),
        name: z.string(),
        role: z.nativeEnum(RecipientRole),
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

export type TAddTemplateSignersMutationSchema = z.infer<typeof ZAddTemplateSignersMutationSchema>;

export const ZCompleteDocumentWithTokenMutationSchema = z.object({
  token: z.string(),
  documentId: z.number(),
});

export type TCompleteDocumentWithTokenMutationSchema = z.infer<
  typeof ZCompleteDocumentWithTokenMutationSchema
>;
