import { z } from 'zod';

export const ZBaseEmbedDataSchema = z.object({
  css: z.string().optional().transform(value => value || undefined),
});
