import { ZUserAuthMethodSchema } from '@documenso/lib/types/user-auth-method';
import { z } from 'zod';

export const ZGetAuthMethodsResponseSchema = z.object({
  authMethods: z.array(ZUserAuthMethodSchema),
});

export type TGetAuthMethodsResponse = z.infer<typeof ZGetAuthMethodsResponseSchema>;
