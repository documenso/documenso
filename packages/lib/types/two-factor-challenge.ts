import { z } from 'zod';

import { isValidReturnTo, normalizeReturnTo } from '../utils/is-valid-return-to';
import { ZSessionAuthMethodSchema } from './session-auth-method';

/**
 * Deferred OAuth account link, executed once the second factor verifies.
 *
 * Access/ID tokens are deliberately not stored here: challenge metadata sits in
 * the database on the strength of primary auth alone.
 */
export const ZTwoFactorChallengeActionSchema = z
  .object({
    type: z.literal('link-oauth-account'),
    provider: z.string().min(1),
    providerAccountId: z.string().min(1),
    email: z.string().email(),
  })
  .strict();

export type TTwoFactorChallengeAction = z.infer<typeof ZTwoFactorChallengeActionSchema>;

/**
 * Strict so nothing can smuggle extra state (such as provider tokens) into
 * challenge metadata.
 */
export const ZTwoFactorChallengeMetadataSchema = z
  .object({
    redirectPath: z
      .string()
      .refine((value) => isValidReturnTo(value), {
        message: 'redirectPath must be a same-origin path',
      })
      .transform((value) => normalizeReturnTo(value) || '/'),
    authMethod: ZSessionAuthMethodSchema,
    action: ZTwoFactorChallengeActionSchema.optional(),
  })
  .strict();

export type TTwoFactorChallengeMetadata = z.infer<typeof ZTwoFactorChallengeMetadataSchema>;
