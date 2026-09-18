import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { GoogleAuthOptions, MicrosoftAuthOptions, OidcAuthOptions } from '../config';
import { handleOAuthAuthorizeUrl } from '../lib/utils/handle-oauth-authorize-url';
import { handleOAuthRevocation } from '../lib/utils/handle-oauth-revocation';
import { getOrganisationAuthenticationPortalOptions } from '../lib/utils/organisation-portal';
import type { HonoAuthContext } from '../types/context';

const ZOAuthAuthorizeSchema = z.object({
  redirectPath: z.string().optional(),
});

export const oauthRoute = new Hono<HonoAuthContext>()
  /**
   * Google authorize endpoint.
   */
  .post('/authorize/google', sValidator('json', ZOAuthAuthorizeSchema), async (c) => {
    const { redirectPath } = c.req.valid('json');

    return handleOAuthAuthorizeUrl({
      c,
      clientOptions: GoogleAuthOptions,
      redirectPath,
    });
  })

  /**
   * Microsoft authorize endpoint.
   */
  .post('/authorize/microsoft', sValidator('json', ZOAuthAuthorizeSchema), async (c) => {
    const { redirectPath } = c.req.valid('json');

    return handleOAuthAuthorizeUrl({
      c,
      clientOptions: MicrosoftAuthOptions,
      redirectPath,
    });
  })

  /**
   * OIDC authorize endpoint.
   */
  .post('/authorize/oidc', sValidator('json', ZOAuthAuthorizeSchema), async (c) => {
    const { redirectPath } = c.req.valid('json');

    return handleOAuthAuthorizeUrl({
      c,
      clientOptions: OidcAuthOptions,
      redirectPath,
    });
  })
  /**
   * Organisation OIDC authorize endpoint.
   */
  .post('/authorize/oidc/org/:orgUrl', async (c) => {
    const orgUrl = c.req.param('orgUrl');

    const { clientOptions } = await getOrganisationAuthenticationPortalOptions({
      type: 'url',
      organisationUrl: orgUrl,
    });

    return await handleOAuthAuthorizeUrl({
      c,
      clientOptions,
      prompt: 'select_account',
    });
  })
  /**
   * OpenID Connect Back-Channel Logout & OAuth Revocation endpoint.
   */
  .post('/backchannel-logout', async (c) => {
    let logoutToken: string | undefined;
    const contentType = c.req.header('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await c.req.json().catch(() => ({}));
      logoutToken = typeof json.logout_token === 'string' ? json.logout_token : undefined;
    } else {
      const body = await c.req.parseBody().catch(() => ({}));
      logoutToken = typeof body.logout_token === 'string' ? body.logout_token : undefined;
    }

    return handleOAuthRevocation({
      c,
      logoutToken,
    });
  });
