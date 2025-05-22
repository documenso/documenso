import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  FieldType,
} from '@prisma/client';
import { z } from 'zod';

import { VALID_DATE_FORMAT_VALUES } from '@documenso/lib/constants/date-formats';
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
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';
import {
  ZFieldHeightSchema,
  ZFieldPageNumberSchema,
  ZFieldPageXSchema,
  ZFieldPageYSchema,
  ZFieldWidthSchema,
} from '@documenso/lib/types/field';
import { ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { ZCreateRecipientSchema } from '../recipient-router/schema';

/**
 * Required for empty responses since we currently can't 201 requests for our openapi setup.
 *
 * Without this it will throw an error in Speakeasy SDK when it tries to parse an empty response.
 */
export const ZSuccessResponseSchema = z.object({
  success: z.literal(true),
});

export const ZGenericSuccessResponse = {
  success: true,
} satisfies z.infer<typeof ZSuccessResponseSchema>;

export const ZDocumentTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .describe('The title of the document.');

export const ZDocumentExternalIdSchema = z
  .string()
  .trim()
  .describe('The external ID of the document.');

export const ZDocumentVisibilitySchema = z
  .nativeEnum(DocumentVisibility)
  .describe('The visibility of the document.');

export const ZDocumentMetaTimezoneSchema = z
  .string()
  .describe(
    'The timezone to use for date fields and signing the document. Example Etc/UTC, Australia/Melbourne',
  );
// Cooked.
// .refine((value) => TIME_ZONES.includes(value), {
//   message: 'Invalid timezone. Please provide a valid timezone',
// });

export type TDocumentMetaTimezone = z.infer<typeof ZDocumentMetaTimezoneSchema>;

export const ZDocumentMetaDateFormatSchema = z
  .enum(VALID_DATE_FORMAT_VALUES)
  .describe('The date format to use for date fields and signing the document.');

export type TDocumentMetaDateFormat = z.infer<typeof ZDocumentMetaDateFormatSchema>;

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
  .describe('Whether to allow recipients to sign using a typed signature.');

export const ZDocumentMetaDrawSignatureEnabledSchema = z
  .boolean()
  .describe('Whether to allow recipients to sign using a draw signature.');

export const ZDocumentMetaUploadSignatureEnabledSchema = z
  .boolean()
  .describe('Whether to allow recipients to sign using an uploaded signature.');

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
  folderId: z.string().describe('Filter documents by folder ID').optional(),
  orderByColumn: z.enum(['createdAt']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).describe('').default('desc'),
});

export const ZFindDocumentsResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
});

export type TFindDocumentsResponse = z.infer<typeof ZFindDocumentsResponseSchema>;

export const ZFindDocumentsInternalRequestSchema = ZFindDocumentsRequestSchema.extend({
  period: z.enum(['7d', '14d', '30d']).optional(),
  senderIds: z.array(z.number()).optional(),
  status: z.nativeEnum(ExtendedDocumentStatus).optional(),
  folderId: z.string().optional(),
});

export const ZFindDocumentsInternalResponseSchema = ZFindResultResponse.extend({
  data: ZDocumentManySchema.array(),
  stats: z.object({
    [ExtendedDocumentStatus.DRAFT]: z.number(),
    [ExtendedDocumentStatus.PENDING]: z.number(),
    [ExtendedDocumentStatus.COMPLETED]: z.number(),
    [ExtendedDocumentStatus.REJECTED]: z.number(),
    [ExtendedDocumentStatus.INBOX]: z.number(),
    [ExtendedDocumentStatus.ALL]: z.number(),
  }),
});

export type TFindDocumentsInternalResponse = z.infer<typeof ZFindDocumentsInternalResponseSchema>;

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
  folderId: z.string().describe('Filter documents by folder ID').optional(),
});

export const ZGetDocumentWithDetailsByIdResponseSchema = ZDocumentSchema;

export const ZCreateDocumentRequestSchema = z.object({
  title: ZDocumentTitleSchema,
  documentDataId: z.string().min(1),
  timezone: ZDocumentMetaTimezoneSchema.optional(),
  folderId: z.string().describe('The ID of the folder to create the document in').optional(),
});

export const ZCreateDocumentV2RequestSchema = z.object({
  title: ZDocumentTitleSchema,
  externalId: ZDocumentExternalIdSchema.optional(),
  visibility: ZDocumentVisibilitySchema.optional(),
  globalAccessAuth: ZDocumentAccessAuthTypesSchema.optional(),
  globalActionAuth: ZDocumentActionAuthTypesSchema.optional(),
  formValues: ZDocumentFormValuesSchema.optional(),
  recipients: z
    .array(
      ZCreateRecipientSchema.extend({
        fields: ZFieldAndMetaSchema.and(
          z.object({
            pageNumber: ZFieldPageNumberSchema,
            pageX: ZFieldPageXSchema,
            pageY: ZFieldPageYSchema,
            width: ZFieldWidthSchema,
            height: ZFieldHeightSchema,
          }),
        )
          .array()
          .optional(),
      }),
    )
    .refine(
      (recipients) => {
        const emails = recipients.map((recipient) => recipient.email);

        return new Set(emails).size === emails.length;
      },
      { message: 'Recipients must have unique emails' },
    )
    .optional(),
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

export type TCreateDocumentV2Request = z.infer<typeof ZCreateDocumentV2RequestSchema>;

export const ZCreateDocumentV2ResponseSchema = z.object({
  document: ZDocumentSchema,
  uploadUrl: z
    .string()
    .describe(
      'The URL to upload the document PDF to. Use a PUT request with the file via form-data',
    ),
});

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
