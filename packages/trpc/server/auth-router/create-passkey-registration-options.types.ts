import { z } from 'zod';

export const ZCreatePasskeyRegistrationOptionsRequestSchema = z.void();

export const ZCreatePasskeyRegistrationOptionsResponseSchema = z.any(); // PublicKeyCredentialCreationOptions type

export type TCreatePasskeyRegistrationOptionsRequest = z.infer<
  typeof ZCreatePasskeyRegistrationOptionsRequestSchema
>;
export type TCreatePasskeyRegistrationOptionsResponse = z.infer<
  typeof ZCreatePasskeyRegistrationOptionsResponseSchema
>;
