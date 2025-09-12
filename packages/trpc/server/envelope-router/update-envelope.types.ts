import { DocumentSigningOrder, EnvelopeType } from '@prisma/client';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZEnvelopeLiteSchema } from '@documenso/lib/types/envelope';

import {
  ZDocumentExternalIdSchema,
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaDistributionMethodSchema,
  ZDocumentMetaDrawSignatureEnabledSchema,
  ZDocumentMetaLanguageSchema,
  ZDocumentMetaMessageSchema,
  ZDocumentMetaRedirectUrlSchema,
  ZDocumentMetaSubjectSchema,
  ZDocumentMetaTimezoneSchema,
  ZDocumentMetaTypedSignatureEnabledSchema,
  ZDocumentMetaUploadSignatureEnabledSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from '../document-router/schema';

// export const updateEnvelopeMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/update',
//     summary: 'Update envelope',
//     tags: ['Envelope'],
//   },
// };

export const ZUpdateEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
  data: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      externalId: ZDocumentExternalIdSchema.nullish(),
      visibility: ZDocumentVisibilitySchema.optional(),
      globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
      globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
      useLegacyFieldInsertion: z.boolean().optional(),
      folderId: z.string().nullish(),
    })
    .optional(),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
      allowDictateNextSigner: z.boolean().optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
      uploadSignatureEnabled: ZDocumentMetaUploadSignatureEnabledSchema.optional(),
      drawSignatureEnabled: ZDocumentMetaDrawSignatureEnabledSchema.optional(),
      emailId: z.string().nullish(),
      emailReplyTo: z.string().email().nullish(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZUpdateEnvelopeResponseSchema = ZEnvelopeLiteSchema;

export type TUpdateEnvelopeRequest = z.infer<typeof ZUpdateEnvelopeRequestSchema>;
export type TUpdateEnvelopeResponse = z.infer<typeof ZUpdateEnvelopeResponseSchema>;
