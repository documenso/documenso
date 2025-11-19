import { z } from 'zod';

import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaLanguageSchema,
} from '@documenso/lib/types/document-meta';
import { DocumentDistributionMethod } from '@documenso/prisma/generated/types';

// Define the schema for configuration
export type TConfigureEmbedFormSchema = z.infer<typeof ZConfigureEmbedFormSchema>;

export const ZConfigureEmbedFormSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  signers: z
    .array(
      z.object({
        nativeId: z.number().optional(),
        formId: z.string(),
        name: z.string(),
        email: z.string().email('Invalid email address'),
        role: z.enum(['SIGNER', 'CC', 'APPROVER', 'VIEWER', 'ASSISTANT']),
        signingOrder: z.number().optional(),
        disabled: z.boolean().optional(),
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
    allowDictateNextSigner: z.boolean().default(false).optional(),
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

export const ZConfigureTemplateEmbedFormSchema = ZConfigureEmbedFormSchema.extend({
  signers: z.array(
    z.object({
      nativeId: z.number().optional(),
      formId: z.string(),
      name: z.string(),
      email: z.union([z.string().length(0), z.string().email('Invalid email address')]),
      role: z.enum(['SIGNER', 'CC', 'APPROVER', 'VIEWER', 'ASSISTANT']),
      signingOrder: z.number().optional(),
      disabled: z.boolean().optional(),
    }),
  ),
});
