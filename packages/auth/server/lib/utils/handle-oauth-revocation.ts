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
};

type ResolvedClientOptions = {
  clientOptions: typeof GoogleAuthOptions;
  provider: string;
};

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

const resolveClientOptions = (iss: string): ResolvedClientOptions => {
  if (iss.includes('accounts.google.com')) {
    return { clientOptions: GoogleAuthOptions, provider: 'google' };
  }

  if (iss.includes('login.microsoftonline.com')) {
    return { clientOptions: MicrosoftAuthOptions, provider: 'microsoft' };
  }

  if (OidcAuthOptions.wellKnownUrl) {
    return { clientOptions: OidcAuthOptions, provider: 'oidc' };
  }

  throw new Error(`Unsupported issuer: ${iss}`);
};

type VerifyLogoutTokenResult = {
  sub: string;
  provider: string;
};

const verifyLogoutToken = async (logoutToken: string): Promise<VerifyLogoutTokenResult> => {
  // Decode JWT without verification to read the issuer (iss).
  const decoded = decodeJwt(logoutToken);
  const iss = decoded.iss;

  if (typeof iss !== 'string') {
    throw new Error('Missing issuer (iss) claim');
  }

  const { clientOptions, provider } = resolveClientOptions(iss);

  // Retrieve provider metadata (issuer + JWKS) via OIDC discovery.
  const oidcConfig = await getOpenIdConfiguration(clientOptions.wellKnownUrl);
  const jwksUri = oidcConfig.jwks_uri;

  if (!jwksUri) {
    throw new Error('OIDC provider configuration lacks jwks_uri');
  }

  // Pin the issuer to the value advertised by the provider discovery document.
  // Multi-tenant providers (e.g. Microsoft "common") expose a `{tenantid}`
  // placeholder, so they fall back to the token's own issuer.
  const discoveredIssuer = oidcConfig.issuer;
  const expectedIssuer = discoveredIssuer && !discoveredIssuer.includes('{tenantid}') ? discoveredIssuer : iss;

  // Verify signature and claims (iss, aud, exp) cryptographically.
  const JWKS = createRemoteJWKSet(new URL(jwksUri));

  const { payload } = await jwtVerify(logoutToken, JWKS, {
    issuer: expectedIssuer,
    audience: clientOptions.clientId,
  });

  // Assert OIDC Back-Channel Logout specific requirements on the verified payload.
  const events = payload.events as Record<string, unknown> | undefined;

  if (!events || !events[BACKCHANNEL_LOGOUT_EVENT]) {
    throw new Error('Missing back-channel logout event claim');
  }

  if (payload.nonce) {
    throw new Error('Logout token must not contain a nonce');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Logout token is missing the subject (sub) claim');
  }

  return { sub: payload.sub, provider };
};

export const handleOAuthRevocation = async ({ c, logoutToken }: HandleOAuthRevocationOptions) => {
  const requestMeta = c.get('requestMetadata') ?? {};

  if (!logoutToken) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Missing logout_token for revocation',
    });
  }

  let targetSub: string;
  let detectedProvider: string;

  try {
    ({ sub: targetSub, provider: detectedProvider } = await verifyLogoutToken(logoutToken));
  } catch (err) {
    if (err instanceof Error) {
      console.error('OAuth revocation JWT error:', err.message);
    }

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: err instanceof Error ? err.message : 'Invalid logout_token signature or claims',
    });
  }

  // Execute database query, session invalidation, audit logging, and account
  // deletion inside an atomic transaction.
  return await prisma.$transaction(async (tx) => {
    const existingAccount = await tx.account.findFirst({
      where: {
        providerAccountId: targetSub,
        provider: detectedProvider,
      },
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
