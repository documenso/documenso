import { msg } from '@lingui/core/macro';
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
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/trpc/server/document-router/schema';

export const ZMapNegativeOneToUndefinedSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (val === '-1') {
      return undefined;
    }

    return val;
  });

export const ZAddSettingsFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: msg`Title cannot be empty`.id }),
  externalId: z.string().optional(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  globalAccessAuth: ZMapNegativeOneToUndefinedSchema.pipe(
    ZDocumentAccessAuthTypesSchema.optional(),
  ),
  globalActionAuth: ZMapNegativeOneToUndefinedSchema.pipe(
    ZDocumentActionAuthTypesSchema.optional(),
  ),
  meta: z.object({
    timezone: ZDocumentMetaTimezoneSchema.optional().default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: ZDocumentMetaDateFormatSchema.optional().default(DEFAULT_DOCUMENT_DATE_FORMAT),
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
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
  }),
});

export type TAddSettingsFormSchema = z.infer<typeof ZAddSettingsFormSchema>;
