import { z } from 'zod';

export const ZApplyMultiSignSignatureRequestSchema = z.object({
  tokens: z.array(z.string()).min(1, { message: 'At least one token is required' }),
  signature: z.string().min(1, { message: 'Signature is required' }),
  isBase64: z.boolean().optional().default(false),
});

export const ZApplyMultiSignSignatureResponseSchema = z.object({
  success: z.boolean(),
});

export type TApplyMultiSignSignatureRequestSchema = z.infer<
  typeof ZApplyMultiSignSignatureRequestSchema
>;
export type TApplyMultiSignSignatureResponseSchema = z.infer<
  typeof ZApplyMultiSignSignatureResponseSchema
>;
