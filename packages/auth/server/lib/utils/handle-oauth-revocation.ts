import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@prisma/client';
import type { Context } from 'hono';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

import { GoogleAuthOptions, MicrosoftAuthOptions, OidcAuthOptions } from '../../config';
import { invalidateAllUserSessions } from '../session/session';
import { getOpenIdConfiguration } from './open-id';

type HandleOAuthRevocationOptions = {
  c: Context;
  logoutToken?: string;
  providerAccountId?: string;
  provider?: string;
};

export const handleOAuthRevocation = async (options: HandleOAuthRevocationOptions) => {
  const { c, logoutToken, providerAccountId, provider } = options;

  const requestMeta = c.get('requestMetadata') ?? {};
  let targetSub = providerAccountId;
  let detectedProvider = provider;

  if (logoutToken) {
    try {
      // Decode JWT without verification to read the issuer (iss)
      const decoded = decodeJwt(logoutToken);
      const iss = decoded.iss;

      if (typeof iss !== 'string') {
        throw new Error('Missing issuer (iss) claim');
      }

      // Match OIDC provider client configuration and provider name based on issuer
      let clientOptions: typeof GoogleAuthOptions;
      if (iss.includes('accounts.google.com')) {
        clientOptions = GoogleAuthOptions;
        detectedProvider = detectedProvider ?? 'google';
      } else if (iss.includes('login.microsoftonline.com')) {
        clientOptions = MicrosoftAuthOptions;
        detectedProvider = detectedProvider ?? 'microsoft';
      } else if (OidcAuthOptions.wellKnownUrl) {
        clientOptions = OidcAuthOptions;
        detectedProvider = detectedProvider ?? 'oidc';
      } else {
        throw new Error(`Unsupported issuer: ${iss}`);
      }

      // Retrieve public keys (JWKS) via OIDC discovery
      const oidcConfig = await getOpenIdConfiguration(clientOptions.wellKnownUrl);
      const jwksUri = oidcConfig.jwks_uri;
      if (!jwksUri) {
        throw new Error('OIDC provider configuration lacks jwks_uri');
      }

      // Verify signature and claims (iss, aud, exp) cryptographically
      const JWKS = createRemoteJWKSet(new URL(jwksUri));
      await jwtVerify(logoutToken, JWKS, {
        issuer: iss,
        audience: clientOptions.clientId,
      });

      // Assert OIDC Back-Channel Logout specific requirements
      const events = decoded.events as Record<string, unknown> | undefined;
      if (!events || !events['http://schemas.openid.net/event/backchannel-logout']) {
        throw new Error('Missing back-channel logout event claim');
      }

      if (decoded.nonce) {
        throw new Error('Logout token must not contain a nonce');
      }

      if (decoded.sub && typeof decoded.sub === 'string') {
        targetSub = decoded.sub;
      } else if (decoded.sid && typeof decoded.sid === 'string') {
        targetSub = decoded.sid;
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error('OAuth revocation JWT error:', err.message);
      }
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: err instanceof Error ? err.message : 'Invalid logout_token signature or claims',
      });
    }
  }

  if (!targetSub) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Missing provider account ID (sub) for revocation',
    });
  }

  const whereCondition: { providerAccountId: string; provider?: string } = {
    providerAccountId: targetSub,
  };

  if (detectedProvider) {
    whereCondition.provider = detectedProvider;
  }

  // Execute database query, session invalidation, audit logging, and account deletion inside an atomic transaction
  return await prisma.$transaction(async (tx) => {
    const existingAccount = await tx.account.findFirst({
      where: whereCondition,
      select: {
        id: true,
        userId: true,
        provider: true,
      },
    });

    if (!existingAccount) {
      return c.json({ success: true, message: 'No associated account found' }, 200);
    }

    // 1. Invalidate all active user sessions inside the transaction
    await invalidateAllUserSessions({
      userId: existingAccount.userId,
      metadata: requestMeta,
      isRevoke: true,
      tx,
    });

    // 2. Remove the revoked OAuth account link inside the transaction
    await tx.account.delete({
      where: {
        id: existingAccount.id,
      },
    });

    // 3. Create security audit log entry for account SSO unlinking
    await tx.userSecurityAuditLog.create({
      data: {
        userId: existingAccount.userId,
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
        type: UserSecurityAuditLogType.ACCOUNT_SSO_UNLINK,
      },
    });

    return c.json({ success: true, message: 'OAuth access revoked and sessions terminated' }, 200);
  });
};
