import { ZRegistrationResponseJSONSchema } from '@documenso/lib/types/webauthn';
import { z } from 'zod';

export const ZCreatePasskeyRequestSchema = z.object({
  passkeyName: z.string().trim().min(1),
  verificationResponse: ZRegistrationResponseJSONSchema,
});

export const ZCreatePasskeyResponseSchema = z.void();

export type TCreatePasskeyRequest = z.infer<typeof ZCreatePasskeyRequestSchema>;
export type TCreatePasskeyResponse = z.infer<typeof ZCreatePasskeyResponseSchema>;
