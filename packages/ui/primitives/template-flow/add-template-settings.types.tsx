import { msg } from '@lingui/core/macro';
import { DocumentDistributionMethod } from '@prisma/client';
import { DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';

export const ZAddTemplateSettingsFormSchema = z.object({
  title: z.string().trim().min(1, { message: "Title can't be empty" }),
  externalId: z.string().optional(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  globalAccessAuth: z
    .array(z.union([ZDocumentAccessAuthTypesSchema, z.literal('-1')]))
    .transform((val) => (val.length === 1 && val[0] === '-1' ? [] : val))
    .optional()
    .default([]),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional().default([]),
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: ZDocumentMetaTimezoneSchema.default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: ZDocumentMetaDateFormatSchema.default(DEFAULT_DOCUMENT_DATE_FORMAT),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    language: z
      .union([z.string(), z.enum(SUPPORTED_LANGUAGE_CODES)])
      .optional()
      .default('en'),
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().email().optional(),
    ),
    emailSettings: ZDocumentEmailSettingsSchema,
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
  }),
});

export type TAddTemplateSettingsFormSchema = z.infer<typeof ZAddTemplateSettingsFormSchema>;
