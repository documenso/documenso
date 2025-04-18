import { z } from 'zod';

import { ZBaseEmbedDataSchema } from './embed-base-schemas';

export const ZBaseEmbedAuthoringSchema = z
  .object({
    token: z.string(),
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
  })
  .and(ZBaseEmbedDataSchema);

export type TBaseEmbedAuthoringSchema = z.infer<typeof ZBaseEmbedAuthoringSchema>;
