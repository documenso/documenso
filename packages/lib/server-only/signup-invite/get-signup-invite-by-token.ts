import { prisma } from '@documenso/prisma';
import type { SignupInvite } from '@prisma/client';
import { SignupInviteStatus } from '@prisma/client';

export const normalizeSignupInviteEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

export const expireSignupInviteIfNeeded = async (invite: SignupInvite): Promise<SignupInvite> => {
  if (invite.status !== SignupInviteStatus.PENDING) {
    return invite;
  }

  if (invite.expiresAt.getTime() > Date.now()) {
    return invite;
  }

  return await prisma.signupInvite.update({
    where: {
      id: invite.id,
    },
    data: {
      status: SignupInviteStatus.EXPIRED,
    },
  });
};

export const getSignupInviteByToken = async (token: string): Promise<SignupInvite | null> => {
  const invite = await prisma.signupInvite.findUnique({
    where: {
      token,
    },
  });

  if (!invite) {
    return null;
  }

  return await expireSignupInviteIfNeeded(invite);
};
