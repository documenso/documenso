import { ZQrSignatureContextSchema } from '@documenso/lib/types/qr-signature';
import { z } from 'zod';

export const ZCreateQrSignatureRequestSchema = z.object({
  context: ZQrSignatureContextSchema.nullish(),
});

export const ZCreateQrSignatureResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.date(),
});

export type TCreateQrSignatureRequest = z.infer<typeof ZCreateQrSignatureRequestSchema>;
export type TCreateQrSignatureResponse = z.infer<typeof ZCreateQrSignatureResponseSchema>;
