import { z } from 'zod';

import { ZBaseEmbedDataSchema } from './embed-base-schemas';

export const ZSignDocumentEmbedDataSchema = ZBaseEmbedDataSchema.extend({
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
  showOtherRecipientsCompletedFields: z.boolean().optional(),
});
