import { isBase64Image } from '@documenso/lib/constants/signatures';
import { z } from 'zod';

export const ZCompleteQrSignatureRequestSchema = z.object({
  token: z.string().min(1).max(64).describe('The QR signature session token'),
  signature: z
    .string()
    .min(1)
    .max(1_000_000)
    .refine((value) => isBase64Image(value), {
      message: 'Signature must be a base64 encoded PNG image',
    }),
});

export const ZCompleteQrSignatureResponseSchema = z.void();

export type TCompleteQrSignatureRequest = z.infer<typeof ZCompleteQrSignatureRequestSchema>;
