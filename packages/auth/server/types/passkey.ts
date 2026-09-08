import { z } from 'zod';

export const ZPasskeyAuthorizeSchema = z.object({
  csrfToken: z.string().min(1),
  credential: z.string().min(1),

  /**
   * Optional client redirect path, validated server-side with
   * `isValidReturnTo`/`normalizeReturnTo` before being echoed back.
   */
  redirectPath: z.string().optional(),
});

export type TPasskeyAuthorizeSchema = z.infer<typeof ZPasskeyAuthorizeSchema>;
