import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { decodeIdToken } from 'arctic';
import type { Context } from 'hono';

import { invalidateAllUserSessions } from '../session/session';

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

  if (logoutToken) {
    try {
      // Decode logout_token JWT payload per OpenID Connect Back-Channel Logout Spec (RFC)
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const claims = decodeIdToken(logoutToken) as Record<string, unknown>;
      
      if (typeof claims.sub === 'string') {
        targetSub = claims.sub;
      }
    } catch {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid logout_token signature or claims',
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

  if (provider) {
    whereCondition.provider = provider;
  }

  const existingAccount = await prisma.account.findFirst({
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

  // 1. Invalidate all active user sessions immediately
  await invalidateAllUserSessions({
    userId: existingAccount.userId,
    metadata: requestMeta,
    isRevoke: true,
  });

  // 2. Remove the revoked OAuth account link
  await prisma.account.delete({
    where: {
      id: existingAccount.id,
    },
  });

  return c.json({ success: true, message: 'OAuth access revoked and sessions terminated' }, 200);
};
