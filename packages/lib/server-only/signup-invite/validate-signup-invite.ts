import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { SignupInviteStatus } from '@prisma/client';

import { getSignupInviteByToken, normalizeSignupInviteEmail } from './get-signup-invite-by-token';

type ValidateSignupInviteOptions = {
  token: string;
  email: string;
};

export const validateSignupInvite = async ({ token, email }: ValidateSignupInviteOptions) => {
  const invite = await getSignupInviteByToken(token);

  if (!invite) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_INVALID, {
      message: 'Signup invite is invalid',
    });
  }

  if (invite.status === SignupInviteStatus.EXPIRED) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_EXPIRED, {
      message: 'Signup invite has expired',
    });
  }

  if (invite.status === SignupInviteStatus.ACCEPTED) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_INVALID, {
      message: 'Signup invite has already been used',
    });
  }

  if (invite.status === SignupInviteStatus.REVOKED) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_INVALID, {
      message: 'Signup invite has been revoked',
    });
  }

  if (invite.status !== SignupInviteStatus.PENDING) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_INVALID, {
      message: 'Signup invite is invalid',
    });
  }

  if (normalizeSignupInviteEmail(invite.email) !== normalizeSignupInviteEmail(email)) {
    throw new AppError(AppErrorCode.SIGNUP_INVITE_INVALID, {
      message: 'Signup invite email does not match',
    });
  }

  return invite;
};
