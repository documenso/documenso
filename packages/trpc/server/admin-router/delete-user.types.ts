import { z } from 'zod';

export const ZDeleteUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZDeleteUserResponseSchema = z.void();

export type TDeleteUserRequest = z.infer<typeof ZDeleteUserRequestSchema>;
export type TDeleteUserResponse = z.infer<typeof ZDeleteUserResponseSchema>;
