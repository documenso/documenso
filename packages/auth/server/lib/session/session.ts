import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { type Session, type User, UserSecurityAuditLogType } from '@prisma/client';

import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { AUTH_SESSION_LIFETIME } from '../../config';

/**
 * The user object to pass around the app.
 *
 * Do not put anything sensitive in here since it will be public.
 */
export type SessionUser = Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'emailVerified'
  | 'avatarImageId'
  | 'twoFactorEnabled'
  | 'roles'
  | 'signature'
  | 'url'
  | 'customerId'
>;

export type SessionValidationResult =
  | {
      session: Session;
      user: SessionUser;
      isAuthenticated: true;
    }
  | { session: null; user: null; isAuthenticated: false };

export const generateSessionToken = (): string => {
  const bytes = new Uint8Array(20);

  crypto.getRandomValues(bytes);

  const token = encodeBase32LowerCaseNoPadding(bytes);

  return token;
};

export const createSession = async (
  token: string,
  userId: number,
  metadata: RequestMetadata,
): Promise<Session> => {
  const hashedSessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const session: Session = {
    id: hashedSessionId,
    sessionToken: hashedSessionId,
    userId,
    updatedAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + AUTH_SESSION_LIFETIME),
    ipAddress: metadata.ipAddress ?? null,
    userAgent: metadata.userAgent ?? null,
  };

  await prisma.session.create({
    data: session,
  });

  await prisma.userSecurityAuditLog.create({
    data: {
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      type: UserSecurityAuditLogType.SIGN_IN,
    },
  });

  return session;
};

export const validateSessionToken = async (token: string): Promise<SessionValidationResult> => {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const result = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      user: {
        /**
         * Do not expose anything sensitive here.
         */
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          avatarImageId: true,
          twoFactorEnabled: true,
          roles: true,
          signature: true,
          url: true,
          customerId: true,
        },
      },
    },
  });

  if (!result?.user) {
    return { session: null, user: null, isAuthenticated: false };
  }

  const { user, ...session } = result;

  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id: sessionId } });
    return { session: null, user: null, isAuthenticated: false };
  }

  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        expiresAt: session.expiresAt,
      },
    });
  }

  return { session, user, isAuthenticated: true };
};

export const invalidateSession = async (
  sessionId: string,
  metadata: RequestMetadata,
): Promise<void> => {
  const session = await prisma.session.delete({ where: { id: sessionId } });

  await prisma.userSecurityAuditLog.create({
    data: {
      userId: session.userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      type: UserSecurityAuditLogType.SIGN_OUT,
    },
  });
};

export const invalidateAllUserSessions = async (
  userId: number,
  metadata: RequestMetadata,
): Promise<void> => {
  const userSessions = await prisma.session.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const userSession of userSessions) {
    try {
      await invalidateSession(userSession.id, metadata);
    } catch (error) {
      console.error(
        `Failed to invalidate session ${userSession.id} for user ${userId} during signout-all:`,
        error,
      );
    }
  }
};

export const invalidateSpecificSession = async (
  currentUserId: number,
  currentSessionId: string,
  targetSessionId: string,
  metadata: RequestMetadata,
): Promise<{
  success: boolean;
  status: number;
  message: string;
}> => {
  try {
    const targetSession = await prisma.session.findUnique({
      where: { id: targetSessionId },
      select: { userId: true },
    });

    if (!targetSession) {
      return {
        success: false,
        status: 404,
        message: 'Target session not found',
      };
    }

    if (targetSession.userId !== currentUserId) {
      return {
        success: false,
        status: 403,
        message: 'Unauthorized to sign out this session',
      };
    }

    await invalidateSession(targetSessionId, metadata);

    return {
      success: true,
      status: 200,
      message: 'Successfully signed out the specified session.',
    };
  } catch (error) {
    console.error('Error signing out specific session:', error);

    return {
      success: false,
      status: 500,
      message: 'Failed to sign out the specified session',
    };
  }
};
