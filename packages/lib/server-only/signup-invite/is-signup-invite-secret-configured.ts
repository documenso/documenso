import { env } from '@documenso/lib/utils/env';

export const isSignupInviteSecretConfigured = (): boolean => {
  const secret = env('NEXT_PRIVATE_SIGNUP_INVITE_SECRET');

  return typeof secret === 'string' && secret.length > 0;
};

export const getSignupInviteSecret = (): string | null => {
  const secret = env('NEXT_PRIVATE_SIGNUP_INVITE_SECRET');

  if (!secret) {
    return null;
  }

  return secret;
};
