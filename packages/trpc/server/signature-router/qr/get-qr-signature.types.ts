import { z } from 'zod';

export const ZGetQrSignatureRequestSchema = z.object({
  token: z.string().min(1).max(64).describe('The QR signature session token to poll'),
});

export const ZGetQrSignatureResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('PENDING'),
  }),
  z.object({
    status: z.literal('EXPIRED'),
  }),
  z.object({
    status: z.literal('COMPLETED'),
    signature: z.string(),
  }),
]);

export type TGetQrSignatureRequest = z.infer<typeof ZGetQrSignatureRequestSchema>;
export type TGetQrSignatureResponse = z.infer<typeof ZGetQrSignatureResponseSchema>;
