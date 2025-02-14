import { Hono } from 'hono';

import { GoogleAuthOptions, OidcAuthOptions } from '../config';
import { handleOAuthCallbackUrl } from '../lib/utils/handle-oauth-callback-url';
import type { HonoAuthContext } from '../types/context';

// Todo: Test
// api/auth/callback/google?
// api/auth/callback/oidc

/**
 * Have to create this route instead of bundling callback with oauth routes to provide
 * backwards compatibility for self-hosters (since we used to use NextAuth).
 */
export const callbackRoute = new Hono<HonoAuthContext>()
  /**
   * OIDC callback verification.
   */
  .get('/oidc', async (c) => handleOAuthCallbackUrl({ c, clientOptions: OidcAuthOptions }))

  /**
   * Google callback verification.
   *
   * Todo: Double check this is the correct callback.
   */
  .get('/google', async (c) => handleOAuthCallbackUrl({ c, clientOptions: GoogleAuthOptions }));
