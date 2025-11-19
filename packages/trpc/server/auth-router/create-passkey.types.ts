import { z } from 'zod';

import { ZRegistrationResponseJSONSchema } from '@doku-seal/lib/types/webauthn';

export const ZCreatePasskeyRequestSchema = z.object({
  passkeyName: z.string().trim().min(1),
  verificationResponse: ZRegistrationResponseJSONSchema,
});

export const ZCreatePasskeyResponseSchema = z.void();

export type TCreatePasskeyRequest = z.infer<typeof ZCreatePasskeyRequestSchema>;
export type TCreatePasskeyResponse = z.infer<typeof ZCreatePasskeyResponseSchema>;
