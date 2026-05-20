import { AppError } from '@documenso/lib/errors/app-error';
import { validateTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/validate-2fa';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import { UserSecurityAuditLogType } from '@prisma/client';
import { Hono } from 'hono';
import { deleteCookie, getSignedCookie } from 'hono/cookie';
import { z } from 'zod';

import { GoogleAuthOptions, MicrosoftAuthOptions, OidcAuthOptions } from '../config';
import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { getAuthSecret, oauth2faCookieName, sessionCookieOptions } from '../lib/session/session-cookies';
import { onAuthorize } from '../lib/utils/authorizer';
import { handleOAuthAuthorizeUrl } from '../lib/utils/handle-oauth-authorize-url';
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
   * OAuth 2FA verification endpoint.
   */
  .post(
    '/verify-2fa',
    sValidator(
      'json',
      z.object({
        totpCode: z.string().trim().optional(),
        backupCode: z.string().trim().optional(),
      }),
    ),
    async (c) => {
      const { totpCode, backupCode } = c.req.valid('json');
      const requestMetadata = c.get('requestMetadata');

      const userIdStr = await getSignedCookie(c, getAuthSecret(), oauth2faCookieName);

      if (!userIdStr) {
        throw new AppError(AuthenticationErrorCode.InvalidRequest, {
          message: 'No pending OAuth 2FA session found',
        });
      }

      const userId = Number(userIdStr);

      const user = await prisma.user.findFirst({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorBackupCodes: true,
        },
      });

      if (!user) {
        throw new AppError(AuthenticationErrorCode.InvalidRequest);
      }

      const isValid = await validateTwoFactorAuthentication({
        backupCode,
        totpCode,
        user,
      });

      if (!isValid) {
        await prisma.userSecurityAuditLog.create({
          data: {
            userId: user.id,
            ipAddress: requestMetadata.ipAddress,
            userAgent: requestMetadata.userAgent,
            type: UserSecurityAuditLogType.SIGN_IN_2FA_FAIL,
          },
        });

        throw new AppError(AuthenticationErrorCode.InvalidTwoFactorCode);
      }

      // Fully authorize user
      await onAuthorize({ userId: user.id }, c);

      // Clear the pending cookie
      deleteCookie(c, oauth2faCookieName, sessionCookieOptions);

      return c.text('OK', 201);
    },
  );
