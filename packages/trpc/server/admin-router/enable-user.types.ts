import { z } from 'zod';

export const ZEnableUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZEnableUserResponseSchema = z.void();

export type TEnableUserRequest = z.infer<typeof ZEnableUserRequestSchema>;
export type TEnableUserResponse = z.infer<typeof ZEnableUserResponseSchema>;
