import { z } from 'zod';

import { ZBaseEmbedDataSchema } from './embed-base-schemas';

export const ZBaseEmbedAuthoringSchema = ZBaseEmbedDataSchema.extend({
  externalId: z.string().optional(),
  features: z
    .object({
      allowConfigureSignatureTypes: z.boolean().optional(),
      allowConfigureLanguage: z.boolean().optional(),
      allowConfigureDateFormat: z.boolean().optional(),
      allowConfigureTimezone: z.boolean().optional(),
      allowConfigureRedirectUrl: z.boolean().optional(),
      allowConfigureCommunication: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

export const ZBaseEmbedAuthoringEditSchema = ZBaseEmbedAuthoringSchema.extend({
  onlyEditFields: z.boolean().optional().default(false),
});

export type TBaseEmbedAuthoringSchema = z.infer<typeof ZBaseEmbedAuthoringSchema>;
export type TBaseEmbedAuthoringEditSchema = z.infer<typeof ZBaseEmbedAuthoringEditSchema>;
