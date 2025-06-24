import { z } from 'zod';

import { ZBaseEmbedDataSchema } from './embed-base-schemas';

export const ZEmbedMultiSignDocumentSchema = ZBaseEmbedDataSchema.extend({
  email: z
    .union([z.literal(''), z.string().email()])
    .optional()
    .transform((value) => value || undefined),
  lockEmail: z.boolean().optional().default(false),
  name: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  lockName: z.boolean().optional().default(false),
  allowDocumentRejection: z.boolean().optional(),
});
