import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { SignupInviteStatus } from '@prisma/client';

import { getSignupInviteByToken } from './get-signup-invite-by-token';

export const consumeSignupInvite = async (token: string) => {
  const invite = await getSignupInviteByToken(token);

  if (!invite || invite.status !== SignupInviteStatus.PENDING) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_INVALID, {
      message: 'Signup invite is invalid',
    });
  }

  return await prisma.signupInvite.update({
    where: {
      id: invite.id,
      status: SignupInviteStatus.PENDING,
    },
    data: {
      status: SignupInviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });
};
