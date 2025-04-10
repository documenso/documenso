import { z } from 'zod';

import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { DocumentDistributionMethod } from '@documenso/prisma/generated/types';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaLanguageSchema,
} from '@documenso/trpc/server/document-router/schema';

// Define the schema for configuration
export type TConfigureEmbedFormSchema = z.infer<typeof ZConfigureEmbedFormSchema>;

export const ZConfigureEmbedFormSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  signers: z
    .array(
      z.object({
        formId: z.string(),
        name: z.string().min(1, { message: 'Name is required' }),
        email: z.string().email('Invalid email address'),
        role: z.enum(['SIGNER', 'CC', 'APPROVER', 'VIEWER', 'ASSISTANT']),
        signingOrder: z.number().optional(),
      }),
    )
    .min(1, { message: 'At least one signer is required' }),
  meta: z.object({
    subject: z.string().optional(),
    message: z.string().optional(),
    distributionMethod: z.nativeEnum(DocumentDistributionMethod),
    emailSettings: ZDocumentEmailSettingsSchema,
    dateFormat: ZDocumentMetaDateFormatSchema.optional(),
    timezone: z.string().min(1, 'Timezone is required'),
    redirectUrl: z.string().optional(),
    language: ZDocumentMetaLanguageSchema.optional(),
    signatureTypes: z.array(z.string()).default([]),
    signingOrder: z.enum(['SEQUENTIAL', 'PARALLEL']),
    allowDictateNextSigner: z.boolean().default(false),
    externalId: z.string().optional(),
  }),
  documentData: z
    .object({
      name: z.string(),
      type: z.string(),
      size: z.number(),
      data: z.instanceof(Uint8Array), // UInt8Array can't be directly validated by zod
    })
    .optional(),
});
