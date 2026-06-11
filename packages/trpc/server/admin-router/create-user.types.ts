import { ZNameSchema } from '@documenso/lib/constants/auth';
import { z } from 'zod';

export const ZCreateUserRequestSchema = z.object({
  email: z.string().email().min(1),
  name: ZNameSchema,
});

export type TCreateUserRequest = z.infer<typeof ZCreateUserRequestSchema>;

export const ZCreateUserResponseSchema = z.object({
  userId: z.number(),
});

export type TCreateUserResponse = z.infer<typeof ZCreateUserResponseSchema>;
