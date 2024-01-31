import type { NextApiRequest, NextApiResponse } from 'next';

import NextAuth from 'next-auth';

import { NEXT_AUTH_OPTIONS } from '@documenso/lib/next-auth/auth-options';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const { ipAddress, userAgent } = extractNextApiRequestMetadata(req);

  return await NextAuth(req, res, {
    ...NEXT_AUTH_OPTIONS,
    pages: {
      signIn: '/signin',
      signOut: '/signout',
      error: '/signin',
    },
    events: {
      signIn: async ({ user }) => {
        await prisma.userSecurityAuditLog.create({
          data: {
            userId: user.id,
            ipAddress,
            userAgent,
            type: UserSecurityAuditLogType.SIGN_IN,
          },
        });
      },
      signOut: async ({ token }) => {
        const userId = typeof token.id === 'string' ? parseInt(token.id) : token.id;

        if (isNaN(userId)) {
          return;
        }

        await prisma.userSecurityAuditLog.create({
          data: {
            userId,
            ipAddress,
            userAgent,
            type: UserSecurityAuditLogType.SIGN_OUT,
          },
        });
      },
      linkAccount: async ({ user }) => {
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

        if (isNaN(userId)) {
          return;
        }

        await prisma.userSecurityAuditLog.create({
          data: {
            userId,
            ipAddress,
            userAgent,
            type: UserSecurityAuditLogType.ACCOUNT_SSO_LINK,
          },
        });
      },
    },
  });
}
