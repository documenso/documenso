import { DocumentSigningOrder, DocumentVisibility, TemplateType } from '@prisma/client';
import { z } from 'zod';

import { ZDocumentSchema } from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZFieldMetaPrefillFieldsSchema } from '@documenso/lib/types/field-meta';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import {
  ZTemplateLiteSchema,
  ZTemplateManySchema,
  ZTemplateSchema,
} from '@documenso/lib/types/template';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';

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
} from '../document-router/schema';
import { ZSignFieldWithTokenMutationSchema } from '../field-router/schema';

export const ZCreateTemplateMutationSchema = z.object({
  title: z.string().min(1).trim(),
  templateDocumentDataId: z.string().min(1),
  folderId: z.string().optional(),
});

export const ZCreateDocumentFromDirectTemplateRequestSchema = z.object({
  directRecipientName: z.string().optional(),
  directRecipientEmail: z.string().email(),
  directTemplateToken: z.string().min(1),
  directTemplateExternalId: z.string().optional(),
  signedFieldValues: z.array(ZSignFieldWithTokenMutationSchema),
  templateUpdatedAt: z.date(),
});

export const ZCreateDocumentFromTemplateRequestSchema = z.object({
  templateId: z.number(),
  recipients: z
    .array(
      z.object({
        id: z.number().describe('The ID of the recipient in the template.'),
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .describe('The information of the recipients to create the document with.')
    .refine((recipients) => {
      const emails = recipients.map((signer) => signer.email);

      return new Set(emails).size === emails.length;
    }, 'Recipients must have unique emails'),
  distributeDocument: z
    .boolean()
    .describe('Whether to create the document as pending and distribute it to recipients.')
    .optional(),
  customDocumentDataId: z
    .string()
    .describe(
      'The data ID of an alternative PDF to use when creating the document. If not provided, the PDF attached to the template will be used.',
    )
    .optional(),
  prefillFields: z
    .array(ZFieldMetaPrefillFieldsSchema)
    .describe(
      'The fields to prefill on the document before sending it out. Useful when you want to create a document from an existing template and pre-fill the fields with specific values.',
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

const GenericDirectLinkResponseSchema = TemplateDirectLinkSchema.pick({
  id: true,
  templateId: true,
  token: true,
  createdAt: true,
  enabled: true,
  directTemplateRecipientId: true,
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

export const MAX_TEMPLATE_PUBLIC_TITLE_LENGTH = 50;
export const MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH = 256;

export const ZUpdateTemplateRequestSchema = z.object({
  templateId: z.number(),
  data: z
    .object({
      title: z.string().min(1).optional(),
      externalId: z.string().nullish(),
      visibility: z.nativeEnum(DocumentVisibility).optional(),
      globalAccessAuth: ZDocumentAccessAuthTypesSchema.nullable().optional(),
      globalActionAuth: ZDocumentActionAuthTypesSchema.nullable().optional(),
      publicTitle: z
        .string()
        .trim()
        .min(1)
        .max(MAX_TEMPLATE_PUBLIC_TITLE_LENGTH)
        .describe(
          'The title of the template that will be displayed to the public. Only applicable for public templates.',
        )
        .optional(),
      publicDescription: z
        .string()
        .trim()
        .min(1)
        .max(MAX_TEMPLATE_PUBLIC_DESCRIPTION_LENGTH)
        .describe(
          'The description of the template that will be displayed to the public. Only applicable for public templates.',
        )
        .optional(),
      type: z.nativeEnum(TemplateType).optional(),
      useLegacyFieldInsertion: z.boolean().optional(),
    })
    .optional(),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
      uploadSignatureEnabled: ZDocumentMetaUploadSignatureEnabledSchema.optional(),
      drawSignatureEnabled: ZDocumentMetaDrawSignatureEnabledSchema.optional(),
      signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
      allowDictateNextSigner: z.boolean().optional(),
    })
    .optional(),
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

export type TCreateTemplateMutationSchema = z.infer<typeof ZCreateTemplateMutationSchema>;
export type TDuplicateTemplateMutationSchema = z.infer<typeof ZDuplicateTemplateMutationSchema>;
export type TDeleteTemplateMutationSchema = z.infer<typeof ZDeleteTemplateMutationSchema>;
export type TBulkSendTemplateMutationSchema = z.infer<typeof ZBulkSendTemplateMutationSchema>;
