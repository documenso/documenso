import { DocumentSigningOrder, DocumentVisibility, TemplateType } from '@prisma/client';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { ZDocumentSchema } from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
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
} from '@documenso/lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';
import { ZFieldMetaPrefillFieldsSchema } from '@documenso/lib/types/field-meta';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import {
  ZTemplateLiteSchema,
  ZTemplateManySchema,
  ZTemplateSchema,
} from '@documenso/lib/types/template';
import { LegacyTemplateDirectLinkSchema } from '@documenso/prisma/types/template-legacy-schema';

import { zodFormData } from '../../utils/zod-form-data';
import { ZSignFieldWithTokenMutationSchema } from '../field-router/schema';

export const MAX_TEMPLATE_PUBLIC_TITLE_LENGTH = 50;
export const MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH = 256;

export const ZTemplateTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .describe('The title of the document.');

export const ZTemplatePublicTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TEMPLATE_PUBLIC_TITLE_LENGTH)
  .describe(
    'The title of the template that will be displayed to the public. Only applicable for public templates.',
  );

export const ZTemplatePublicDescriptionSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH)
  .describe(
    'The description of the template that will be displayed to the public. Only applicable for public templates.',
  );

export const ZTemplateMetaUpsertSchema = z.object({
  subject: ZDocumentMetaSubjectSchema.optional(),
  message: ZDocumentMetaMessageSchema.optional(),
  timezone: ZDocumentMetaTimezoneSchema.optional(),
  dateFormat: ZDocumentMetaDateFormatSchema.optional(),
  distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
  emailId: z.string().nullish(),
  emailReplyTo: z.string().email().nullish(),
  emailSettings: ZDocumentEmailSettingsSchema.optional(),
  redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
  language: ZDocumentMetaLanguageSchema.optional(),
  typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
  uploadSignatureEnabled: ZDocumentMetaUploadSignatureEnabledSchema.optional(),
  drawSignatureEnabled: ZDocumentMetaDrawSignatureEnabledSchema.optional(),
  signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
  allowDictateNextSigner: z.boolean().optional(),
});

export const ZCreateDocumentFromDirectTemplateRequestSchema = z.object({
  directRecipientName: z.string().max(255).optional(),
  directRecipientEmail: z.string().email().max(254),
  directTemplateToken: z.string().min(1),
  directTemplateExternalId: z.string().optional(),
  signedFieldValues: z.array(ZSignFieldWithTokenMutationSchema),
  templateUpdatedAt: z.date(),
  nextSigner: z
    .object({
      email: z.string().email().max(254),
      name: z.string().min(1).max(255),
    })
    .optional(),
});

export const ZCreateDocumentFromTemplateRequestSchema = z.object({
  templateId: z.number(),
  recipients: z
    .array(
      z.object({
        id: z.number().describe('The ID of the recipient in the template.'),
        email: z.string().email().max(254),
        name: z.string().max(255).optional(),
      }),
    )
    .describe('The information of the recipients to create the document with.'),
  distributeDocument: z
    .boolean()
    .describe('Whether to create the document as pending and distribute it to recipients.')
    .optional(),
  customDocumentDataId: z
    .string()
    .describe(
      '[DEPRECATED] - Use customDocumentData instead. The data ID of an alternative PDF to use when creating the document. If not provided, the PDF attached to the template will be used.',
    )
    .optional(),
  customDocumentData: z
    .array(
      z.object({
        documentDataId: z.string(),
        envelopeItemId: z.string(),
      }),
    )
    .describe(
      'The data IDs of alternative PDFs to use when creating the document. If not provided, the PDF attached to the template will be used.',
    )
    .optional(),

  folderId: z
    .string()
    .describe(
      'The ID of the folder to create the document in. If not provided, the document will be created in the root folder.',
    )
    .optional(),

  prefillFields: z
    .array(ZFieldMetaPrefillFieldsSchema)
    .describe(
      'The fields to prefill on the document before sending it out. Useful when you want to create a document from an existing template and pre-fill the fields with specific values.',
    )
    .optional(),

  override: z
    .object({
      title: z.string().min(1).max(255).optional(),
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
      uploadSignatureEnabled: ZDocumentMetaUploadSignatureEnabledSchema.optional(),
      drawSignatureEnabled: ZDocumentMetaDrawSignatureEnabledSchema.optional(),
      allowDictateNextSigner: z.boolean().optional(),
    })
    .describe('Override values from the template for the created document.')
    .optional(),

  attachments: z
    .array(
      z.object({
        label: z.string().min(1, 'Label is required'),
        data: z.string().url('Must be a valid URL'),
        type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
      }),
    )
    .optional(),
});

export const ZCreateDocumentFromTemplateResponseSchema = ZDocumentSchema;

export const ZDuplicateTemplateMutationSchema = z.object({
  templateId: z.number(),
});

export const ZDuplicateTemplateResponseSchema = ZTemplateLiteSchema;

export const ZCreateTemplateDirectLinkRequestSchema = z.object({
  templateId: z.number(),
  directRecipientId: z
    .number()
    .describe(
      'The of the recipient in the current template to transform into the primary recipient when the template is used.',
    )
    .optional(),
});

const GenericDirectLinkResponseSchema = LegacyTemplateDirectLinkSchema.pick({
  id: true,
  token: true,
  createdAt: true,
  enabled: true,
  directTemplateRecipientId: true,
  envelopeId: true,
  templateId: true,
});

export const ZCreateTemplateDirectLinkResponseSchema = GenericDirectLinkResponseSchema;

export const ZDeleteTemplateDirectLinkRequestSchema = z.object({
  templateId: z.number(),
});

export const ZToggleTemplateDirectLinkRequestSchema = z.object({
  templateId: z.number(),
  enabled: z.boolean(),
});

export const ZToggleTemplateDirectLinkResponseSchema = GenericDirectLinkResponseSchema;

export const ZDeleteTemplateMutationSchema = z.object({
  templateId: z.number(),
});

/**
 * Note: This is the same between V1 and V2. Be careful when updating this schema and think of the consequences.
 */
export const ZCreateTemplateV2RequestSchema = z.object({
  title: ZTemplateTitleSchema,
  folderId: z.string().optional(),
  externalId: z.string().nullish(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional().default([]),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional().default([]),
  publicTitle: ZTemplatePublicTitleSchema.optional(),
  publicDescription: ZTemplatePublicDescriptionSchema.optional(),
  type: z.nativeEnum(TemplateType).optional(),
  meta: ZTemplateMetaUpsertSchema.optional(),
  attachments: z
    .array(
      z.object({
        label: z.string().min(1, 'Label is required'),
        data: z.string().url('Must be a valid URL'),
        type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
      }),
    )
    .optional(),
});

/**
 * Note: This is the same between V1 and V2. Be careful when updating this schema and think of the consequences.
 */
export const ZCreateTemplateV2ResponseSchema = z.object({
  template: ZTemplateSchema,
  uploadUrl: z.string().min(1),
});

export const ZCreateTemplateResponseSchema = z.object({
  envelopeId: z.string(),
  id: z.number(),
});

export const ZCreateTemplatePayloadSchema = ZCreateTemplateV2RequestSchema;

export const ZCreateTemplateMutationSchema = zodFormData({
  payload: zfd.json(ZCreateTemplatePayloadSchema),
  file: zfd.file(),
});

export const ZUpdateTemplateRequestSchema = z.object({
  templateId: z.number(),
  data: z
    .object({
      title: ZTemplateTitleSchema.optional(),
      externalId: z.string().nullish(),
      visibility: z.nativeEnum(DocumentVisibility).optional(),
      globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional().default([]),
      globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional().default([]),
      publicTitle: ZTemplatePublicTitleSchema.optional(),
      publicDescription: ZTemplatePublicDescriptionSchema.optional(),
      type: z.nativeEnum(TemplateType).optional(),
      useLegacyFieldInsertion: z.boolean().optional(),
      folderId: z.string().nullish(),
    })
    .optional(),
  meta: ZTemplateMetaUpsertSchema.optional(),
});

export const ZUpdateTemplateResponseSchema = ZTemplateLiteSchema;

export const ZFindTemplatesRequestSchema = ZFindSearchParamsSchema.extend({
  type: z.nativeEnum(TemplateType).describe('Filter templates by type.').optional(),
  folderId: z.string().describe('The ID of the folder to filter templates by.').optional(),
});

export const ZFindTemplatesResponseSchema = ZFindResultResponse.extend({
  data: ZTemplateManySchema.array(),
});

export type TFindTemplatesResponse = z.infer<typeof ZFindTemplatesResponseSchema>;
export type FindTemplateRow = TFindTemplatesResponse['data'][number];

export const ZGetTemplateByIdRequestSchema = z.object({
  templateId: z.number(),
});

export const ZGetTemplateByIdResponseSchema = ZTemplateSchema;

export const ZBulkSendTemplateMutationSchema = z.object({
  templateId: z.number(),
  teamId: z.number(),
  csv: z.string().min(1),
  sendImmediately: z.boolean(),
});

export type TCreateTemplatePayloadSchema = z.input<typeof ZCreateTemplatePayloadSchema>;
export type TCreateTemplateMutationSchema = z.infer<typeof ZCreateTemplateMutationSchema>;
export type TDuplicateTemplateMutationSchema = z.infer<typeof ZDuplicateTemplateMutationSchema>;
export type TDeleteTemplateMutationSchema = z.infer<typeof ZDeleteTemplateMutationSchema>;
export type TBulkSendTemplateMutationSchema = z.infer<typeof ZBulkSendTemplateMutationSchema>;
