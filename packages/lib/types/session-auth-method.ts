import { z } from 'zod';

/**
 * The method used to authenticate a session.
 *
 * Stored as a plain string on `Session.authMethod` (deliberately not a PG
 * enum). `unknown` is the column default and covers sessions created before
 * the column existed.
 */
export const ZSessionAuthMethodSchema = z.enum(['email-password', 'oauth', 'passkey', 'unknown']);

export type TSessionAuthMethod = z.infer<typeof ZSessionAuthMethodSchema>;
