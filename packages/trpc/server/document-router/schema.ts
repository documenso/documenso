import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import {
  ZDocumentLiteSchema,
  ZDocumentManySchema,
  ZDocumentSchema,
} from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  FieldType,
} from '@documenso/prisma/client';

export const ZDocumentMetaTimezoneSchema = z
  .string()
  .describe('The timezone to use for date fields and signing the document.');

export const ZDocumentMetaDateFormatSchema = z
  .string()
  .describe('The date format to use for date fields and signing the document.');

export const ZDocumentMetaRedirectUrlSchema = z
  .string()
  .describe('The URL to which the recipient should be redirected after signing the document.')
  .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
    message: 'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
  });

export const ZDocumentMetaLanguageSchema = z
  .enum(SUPPORTED_LANGUAGE_CODES)
  .describe('The language to use for email communications with recipients.');

export const ZDocumentMetaSubjectSchema = z
  .string()
  .describe('The subject of the email that will be sent to the recipients.');

export const ZDocumentMetaMessageSchema = z
  .string()
  .describe('The message of the email that will be sent to the recipients.');

export const ZDocumentMetaDistributionMethodSchema = z
  .nativeEnum(DocumentDistributionMethod)
  .describe('The distribution method to use when sending the document to the recipients.');

export const ZDocumentMetaTypedSignatureEnabledSchema = z
  .boolean()
  .describe('Whether to allow typed signatures.');

export const ZFindDocumentsRequestSchema = ZFindSearchParamsSchema.extend({
  templateId: z
    .number()
    .describe('Filter documents by the template ID used to create it.')
    .optional(),
  source: z
    .nativeEnum(DocumentSource)
    .describe('Filter documents by how it was created.')
    .optional(),
  status: z
    .nativeEnum(DocumentStatus)
    .describe('Filter documents by the current status')
    .optional(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).describe('').default('desc'),
});

export const ZFindDocumentsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindDocumentsResponse = z.infer<typeof ZFindDocumentsResponseSchema>;

export const ZFindDocumentAuditLogsQuerySchema = ZFindSearchParamsSchema.extend({
  documentId: z.number().min(1),
  cursor: z.string().optional(),
  filterForRecentActivity: z.boolean().optional(),
  orderByColumn: z.enum(['createdAt', 'type']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const ZGetDocumentByIdQuerySchema = z.object({
  documentId: z.number(),
});

export const ZDuplicateDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZDuplicateDocumentResponseSchema = z.object({
  documentId: z.number(),
});

export const ZGetDocumentByTokenQuerySchema = z.object({
  token: z.string().min(1),
});

export type TGetDocumentByTokenQuerySchema = z.infer<typeof ZGetDocumentByTokenQuerySchema>;

export const ZGetDocumentWithDetailsByIdRequestSchema = z.object({
  documentId: z.number(),
});

export const ZGetDocumentWithDetailsByIdResponseSchema = ZDocumentSchema;

export const ZCreateDocumentRequestSchema = z.object({
  title: z.string().min(1),
  documentDataId: z.string().min(1),
  timezone: z.string().optional(),
});

export const ZUpdateDocumentRequestSchema = z.object({
  documentId: z.number(),
  data: z
    .object({
      title: z.string().describe('The title of the document.').min(1).optional(),
      externalId: z.string().nullish().describe('The external ID of the document.'),
      visibility: z
        .nativeEnum(DocumentVisibility)
        .describe('The visibility of the document.')
        .optional(),
      globalAccessAuth: ZDocumentAccessAuthTypesSchema.nullable().optional(),
      globalActionAuth: ZDocumentActionAuthTypesSchema.nullable().optional(),
    })
    .optional(),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      typedSignatureEnabled: ZDocumentMetaTypedSignatureEnabledSchema.optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZUpdateDocumentResponseSchema = ZDocumentLiteSchema;

export const ZSetFieldsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  fields: z.array(
    z.object({
      id: z.number().nullish(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
    }),
  ),
});

export type TSetFieldsForDocumentMutationSchema = z.infer<
  typeof ZSetFieldsForDocumentMutationSchema
>;

export const ZDistributeDocumentRequestSchema = z.object({
  documentId: z.number().describe('The ID of the document to send.'),
  meta: z
    .object({
      subject: ZDocumentMetaSubjectSchema.optional(),
      message: ZDocumentMetaMessageSchema.optional(),
      timezone: ZDocumentMetaTimezoneSchema.optional(),
      dateFormat: ZDocumentMetaDateFormatSchema.optional(),
      distributionMethod: ZDocumentMetaDistributionMethodSchema.optional(),
      redirectUrl: ZDocumentMetaRedirectUrlSchema.optional(),
      language: ZDocumentMetaLanguageSchema.optional(),
      emailSettings: ZDocumentEmailSettingsSchema.optional(),
    })
    .optional(),
});

export const ZDistributeDocumentResponseSchema = ZDocumentLiteSchema;

export const ZSetPasswordForDocumentMutationSchema = z.object({
  documentId: z.number(),
  password: z.string(),
});

export type TSetPasswordForDocumentMutationSchema = z.infer<
  typeof ZSetPasswordForDocumentMutationSchema
>;

export const ZSetSigningOrderForDocumentMutationSchema = z.object({
  documentId: z.number(),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
});

export type TSetSigningOrderForDocumentMutationSchema = z.infer<
  typeof ZSetSigningOrderForDocumentMutationSchema
>;

export const ZResendDocumentMutationSchema = z.object({
  documentId: z.number(),
  recipients: z
    .array(z.number())
    .min(1)
    .describe('The IDs of the recipients to redistribute the document to.'),
});

export const ZDeleteDocumentMutationSchema = z.object({
  documentId: z.number(),
});

export type TDeleteDocumentMutationSchema = z.infer<typeof ZDeleteDocumentMutationSchema>;

export const ZSearchDocumentsMutationSchema = z.object({
  query: z.string(),
});

export const ZDownloadAuditLogsMutationSchema = z.object({
  documentId: z.number(),
});

export const ZDownloadCertificateMutationSchema = z.object({
  documentId: z.number(),
});

export const ZMoveDocumentToTeamSchema = z.object({
  documentId: z.number().describe('The ID of the document to move to a team.'),
  teamId: z.number().describe('The ID of the team to move the document to.'),
});

export const ZMoveDocumentToTeamResponseSchema = ZDocumentLiteSchema;
