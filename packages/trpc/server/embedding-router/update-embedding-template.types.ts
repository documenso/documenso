import { DocumentSigningOrder, FieldType, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  ZFieldHeightSchema,
  ZFieldPageNumberSchema,
  ZFieldPageXSchema,
  ZFieldPageYSchema,
  ZFieldWidthSchema,
} from '@documenso/lib/types/field';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

import {
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
} from '../document-router/schema';

const ZFieldSchema = z.object({
  id: z.number().optional(),
  type: z.nativeEnum(FieldType),
  pageNumber: ZFieldPageNumberSchema,
  pageX: ZFieldPageXSchema,
  pageY: ZFieldPageYSchema,
  width: ZFieldWidthSchema,
  height: ZFieldHeightSchema,
  fieldMeta: ZFieldMetaSchema.optional(),
});

export const ZUpdateEmbeddingTemplateRequestSchema = z.object({
  templateId: z.number(),
  title: ZDocumentTitleSchema.optional(),
  externalId: z.string().optional(),
  recipients: z.array(
    z.object({
      id: z.number().optional(),
      email: z.string().email(),
      name: z.string().optional(),
      role: z.nativeEnum(RecipientRole).optional(),
      signingOrder: z.number().optional(),
      fields: z.array(ZFieldSchema).optional(),
    }),
  ),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
      drawSignatureEnabled: ZDocumentMetaDrawSignatureEnabledSchema.optional(),
      uploadSignatureEnabled: ZDocumentMetaUploadSignatureEnabledSchema.optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZUpdateEmbeddingTemplateResponseSchema = z.object({
  templateId: z.number(),
});

export type TUpdateEmbeddingTemplateRequestSchema = z.infer<
  typeof ZUpdateEmbeddingTemplateRequestSchema
>;
