import { z } from 'zod';

import { ZCssVarsSchema } from '../utils/css-vars';

export const ZBaseEmbedDataSchema = z.object({
  darkModeDisabled: z.boolean().optional().default(false),
  css: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  cssVars: ZCssVarsSchema.optional().default({}),
});
