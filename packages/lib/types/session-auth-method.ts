import { z } from 'zod';

// `unknown` covers sessions created before the column existed.
export const ZSessionAuthMethodSchema = z.enum(['email-password', 'oauth', 'passkey', 'unknown']);

export type TSessionAuthMethod = z.infer<typeof ZSessionAuthMethodSchema>;
