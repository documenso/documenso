import { z } from 'zod';

export const ZDisableUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZDisableUserResponseSchema = z.void();

export type TDisableUserRequest = z.infer<typeof ZDisableUserRequestSchema>;
export type TDisableUserResponse = z.infer<typeof ZDisableUserResponseSchema>;
