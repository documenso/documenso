import { z } from 'zod';

export const ZCreatePasskeyAuthenticationOptionsRequestSchema = z
  .object({
    preferredPasskeyId: z.string().optional(),
  })
  .optional();

export const ZCreatePasskeyAuthenticationOptionsResponseSchema = z.object({
  tokenReference: z.string(),
  options: z.any(), // PublicKeyCredentialRequestOptions type
});

export type TCreatePasskeyAuthenticationOptionsRequest = z.infer<
  typeof ZCreatePasskeyAuthenticationOptionsRequestSchema
>;
export type TCreatePasskeyAuthenticationOptionsResponse = z.infer<
  typeof ZCreatePasskeyAuthenticationOptionsResponseSchema
>;
