import { z } from 'zod';

import { ZDocumentSchema } from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { DocumentSigningOrder, DocumentVisibility, TemplateType } from '@documenso/prisma/client';

import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaDistributionMethodSchema,
  ZDocumentMetaLanguageSchema,
  ZDocumentMetaMessageSchema,
  ZDocumentMetaRedirectUrlSchema,
  ZDocumentMetaSubjectSchema,
  ZDocumentMetaTimezoneSchema,
  ZDocumentMetaTypedSignatureEnabledSchema,
} from '../document-router/schema';
import { ZSignFieldWithTokenMutationSchema } from '../field-router/schema';

export const ZCreateTemplateMutationSchema = z.object({
  title: z.string().min(1).trim(),
  templateDocumentDataId: z.string().min(1),
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
});

export const ZCreateDocumentFromTemplateResponseSchema = ZDocumentSchema;

export const ZDuplicateTemplateMutationSchema = z.object({
  templateId: z.number(),
});

export const ZCreateTemplateDirectLinkMutationSchema = z.object({
  templateId: z.number(),
  directRecipientId: z
    .number()
    .describe(
      'The of the recipient in the current template to transform into the primary recipient when the template is used.',
    )
    .optional(),
});

export const ZDeleteTemplateDirectLinkMutationSchema = z.object({
  templateId: z.number(),
});

export const ZToggleTemplateDirectLinkMutationSchema = z.object({
  templateId: z.number(),
  enabled: z.boolean(),
});

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
      signingOrder: z.nativeEnum(DocumentSigningOrder).optional(),
    })
    .optional(),
});

export const ZFindTemplatesRequestSchema = ZFindSearchParamsSchema.extend({
  type: z.nativeEnum(TemplateType).describe('Filter templates by type.').optional(),
});

export const ZGetTemplateByIdRequestSchema = z.object({
  templateId: z.number(),
});

export const ZMoveTemplatesToTeamRequestSchema = z.object({
  templateId: z.number().describe('The ID of the template to move to.'),
  teamId: z.number().describe('The ID of the team to move the template to.'),
});

export type TCreateTemplateMutationSchema = z.infer<typeof ZCreateTemplateMutationSchema>;
export type TDuplicateTemplateMutationSchema = z.infer<typeof ZDuplicateTemplateMutationSchema>;
export type TDeleteTemplateMutationSchema = z.infer<typeof ZDeleteTemplateMutationSchema>;
