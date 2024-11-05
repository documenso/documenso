import { z } from 'zod';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';

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
  title: z.string().trim().min(1, { message: "Title can't be empty" }),
  externalId: z.string().optional(),
  visibility: z.string().optional(),
  globalAccessAuth: ZMapNegativeOneToUndefinedSchema.pipe(
    ZDocumentAccessAuthTypesSchema.optional(),
  ),
  globalActionAuth: ZMapNegativeOneToUndefinedSchema.pipe(
    ZDocumentActionAuthTypesSchema.optional(),
  ),
  meta: z.object({
    timezone: z.string().optional().default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: z.string().optional().default(DEFAULT_DOCUMENT_DATE_FORMAT),
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
  }),
});

export type TAddSettingsFormSchema = z.infer<typeof ZAddSettingsFormSchema>;
