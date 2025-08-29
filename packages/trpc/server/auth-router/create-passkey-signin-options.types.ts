import { z } from 'zod';

export const ZCreatePasskeySigninOptionsRequestSchema = z.void();

export const ZCreatePasskeySigninOptionsResponseSchema = z.object({
  options: z.any(), // PublicKeyCredentialRequestOptions type
  sessionId: z.string(),
});

export type TCreatePasskeySigninOptionsRequest = z.infer<
  typeof ZCreatePasskeySigninOptionsRequestSchema
>;
export type TCreatePasskeySigninOptionsResponse = z.infer<
  typeof ZCreatePasskeySigninOptionsResponseSchema
>;
