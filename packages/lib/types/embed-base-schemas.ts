import { z } from 'zod';

import { ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/locales';

import { ZCssVarsSchema } from './css-vars';

export const ZBaseEmbedDataSchema = z.object({
  darkModeDisabled: z.boolean().optional().default(false),
  css: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  cssVars: ZCssVarsSchema.optional().default({}),
  language: ZSupportedLanguageCodeSchema.optional(),
});
