import { msg } from '@lingui/core/macro';
import { DocumentDistributionMethod, DocumentSigningOrder } from '@prisma/client';
import { z } from 'zod';

import { VALID_DATE_FORMAT_VALUES } from '@documenso/lib/constants/date-formats';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';

import { ZDocumentEmailSettingsSchema } from './document-email';

/**
 * The full document response schema.
 *
 * Mainly used for returning a single document from the API.
 */
export const ZDocumentMetaSchema = DocumentMetaSchema.pick({
  signingOrder: true,
  distributionMethod: true,
  id: true,
  subject: true,
  message: true,
  timezone: true,
  dateFormat: true,
  redirectUrl: true,
  typedSignatureEnabled: true,
  uploadSignatureEnabled: true,
  drawSignatureEnabled: true,
  language: true,
  emailSettings: true,
});

export type TDocumentMeta = z.infer<typeof ZDocumentMetaSchema>;

/**
 * If you update this, you must also update the schema.prisma @default value for
 * - Template meta
 * - Document meta
 */
export const ZDocumentSignatureSettingsSchema = z
  .object({
    typedSignatureEnabled: z.boolean(),
    uploadSignatureEnabled: z.boolean(),
    drawnSignatureEnabled: z.boolean(),
  })
  .refine(
    (data) => {
      return (
        data.typedSignatureEnabled || data.uploadSignatureEnabled || data.drawnSignatureEnabled
      );
    },
    {
      message: msg`At least one signature type must be enabled`.id,
    },
  );

export type TDocumentSignatureSettings = z.infer<typeof ZDocumentSignatureSettingsSchema>;

export const ZDocumentMetaTimezoneSchema = z
  .string()
  .describe(
    'The timezone to use for date fields and signing the document. Example Etc/UTC, Australia/Melbourne',
  );

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
  .max(254)
  .describe('The subject of the email that will be sent to the recipients.');

export const ZDocumentMetaMessageSchema = z
  .string()
  .max(5000)
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

/**
 * Note: Any updates to this will cause public API changes. You will need to update
 * all corresponding areas where this is used (some places that use this needs to pass
 * it through to another function).
 */
export const ZDocumentMetaCreateSchema = z.object({
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
  emailSettings: ZDocumentEmailSettingsSchema.nullish(),
});

export type TDocumentMetaCreate = z.infer<typeof ZDocumentMetaCreateSchema>;

/**
 * Note: This is the same as the create schema for now since there are
 * no nullable values. Once there is we will need to update this properly.
 */
export const ZDocumentMetaUpdateSchema = ZDocumentMetaCreateSchema;

export type TDocumentMetaUpdate = z.infer<typeof ZDocumentMetaUpdateSchema>;
