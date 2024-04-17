import { z } from 'zod';

export const ZEarlyAdopterCheckoutMetadataSchema = z.object({
  name: z.string(),
  email: z.string(),
  signatureText: z.string(),
  signatureDataUrl: z.string().optional(),
  source: z.literal('marketing'),
});

export type TEarlyAdopterCheckoutMetadataSchema = z.infer<
  typeof ZEarlyAdopterCheckoutMetadataSchema
>;
