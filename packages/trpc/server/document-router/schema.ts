import { DocumentDistributionMethod, DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

import { VALID_DATE_FORMAT_VALUES } from '@documenso/lib/constants/date-formats';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';

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
