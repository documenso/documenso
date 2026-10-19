import { z } from 'zod';

export const ZPasskeyAuthorizeSchema = z.object({
  csrfToken: z.string().min(1),
  credential: z.string().min(1),
  redirectPath: z.string().optional(),
});

export type TPasskeyAuthorizeSchema = z.infer<typeof ZPasskeyAuthorizeSchema>;
