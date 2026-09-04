import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { SignupInviteStatus } from '@prisma/client';

import { getSignupInviteByToken } from './get-signup-invite-by-token';

export const revokeSignupInvite = async (token: string) => {
  const invite = await getSignupInviteByToken(token);

  if (!invite) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Signup invite not found',
    });
  }

  if (invite.status === SignupInviteStatus.ACCEPTED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Signup invite has already been accepted',
    });
  }

  return await prisma.signupInvite.update({
    where: {
      id: invite.id,
    },
    data: {
      status: SignupInviteStatus.REVOKED,
    },
  });
};
