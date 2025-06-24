import { DocumentSigningOrder } from '@prisma/client';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { ZDocumentLiteSchema } from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import AttachmentSchema from '@documenso/prisma/generated/zod/modelSchema/AttachmentSchema';

import type { TrpcRouteMeta } from '../trpc';
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
} from './schema';

export const updateDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/update',
    summary: 'Update document',
    tags: ['Document'],
  },
};

export const ZUpdateDocumentRequestSchema = z.object({
  documentId: z.number(),
  data: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      externalId: ZDocumentExternalIdSchema.nullish(),
      visibility: ZDocumentVisibilitySchema.optional(),
      globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
      globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
      useLegacyFieldInsertion: z.boolean().optional(),
      attachments: AttachmentSchema.pick({
        id: true,
        label: true,
        url: true,
      })
        .array()
        .optional(),
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
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZUpdateDocumentResponseSchema = ZDocumentLiteSchema;
