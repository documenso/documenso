import { z } from 'zod';

import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

export const ZGetUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZGetUserResponseSchema = UserSchema.pick({
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  roles: true,
  disabled: true,
  twoFactorEnabled: true,
  signature: true,
});

export type TGetUserRequest = z.infer<typeof ZGetUserRequestSchema>;
export type TGetUserResponse = z.infer<typeof ZGetUserResponseSchema>;
