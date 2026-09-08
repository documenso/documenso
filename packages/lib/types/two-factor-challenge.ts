import { z } from 'zod';

import { isValidReturnTo, normalizeReturnTo } from '../utils/is-valid-return-to';
import { ZSessionAuthMethodSchema } from './session-auth-method';

/**
 * Deferred OAuth account-link action stored in pending 2FA challenge metadata.
 *
 * When an OAuth callback would link a new provider account to an existing
 * 2FA-enabled user, NO account mutation may happen before the second factor
 * verifies. The entire link transaction is deferred: this payload carries just
 * enough to recreate it after the code passes.
 *
 * Access/ID tokens are deliberately NOT stored here — the deferred account row
 * is created without them. Challenge metadata lives in the database for up to
 * 10 minutes on the strength of primary auth alone, and provider tokens must
 * never be obtainable from a stolen challenge row.
 */
export const ZTwoFactorChallengeActionSchema = z
  .object({
    type: z.literal('link-oauth-account'),

    /**
     * The OAuth provider id (e.g. 'google', 'microsoft', 'oidc').
     */
    provider: z.string().min(1),

    /**
     * The provider subject (`sub` claim) identifying the external account.
     */
    providerAccountId: z.string().min(1),

    /**
     * The user's email at the time of the OAuth callback. Execution re-checks
     * that the user's email is unchanged before linking.
     */
    email: z.string().email(),
  })
  .strict();

export type TTwoFactorChallengeAction = z.infer<typeof ZTwoFactorChallengeActionSchema>;

/**
 * Metadata stored on a pending 2FA challenge verification token.
 *
 * Strict: unknown keys are rejected so nothing can smuggle extra state (such
 * as provider tokens) into challenge metadata.
 */
export const ZTwoFactorChallengeMetadataSchema = z
  .object({
    /**
     * Where to send the user after the challenge passes. Validated as a
     * same-origin path both when written and when read back.
     */
    redirectPath: z
      .string()
      .refine((value) => isValidReturnTo(value), {
        message: 'redirectPath must be a same-origin path',
      })
      .transform((value) => normalizeReturnTo(value) || '/'),

    /**
     * The primary authentication method that initiated this challenge. The
     * session created after the code verifies is stamped with this value.
     */
    authMethod: ZSessionAuthMethodSchema,

    /**
     * Optional deferred OAuth account-link action, executed in the same
     * transaction as token consumption after the code verifies.
     */
    action: ZTwoFactorChallengeActionSchema.optional(),
  })
  .strict();

export type TTwoFactorChallengeMetadata = z.infer<typeof ZTwoFactorChallengeMetadataSchema>;
