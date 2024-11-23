import { z } from 'zod';

import { ZCssVarsSchema } from './css-vars';

export const ZBaseEmbedDataSchema = z.object({
  css: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  cssVars: ZCssVarsSchema.optional().default({}),
});
