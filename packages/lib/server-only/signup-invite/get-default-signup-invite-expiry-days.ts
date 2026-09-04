import { env } from '@documenso/lib/utils/env';

const DEFAULT_SIGNUP_INVITE_EXPIRY_DAYS = 7;
const MAX_SIGNUP_INVITE_EXPIRY_DAYS = 30;

export const getDefaultSignupInviteExpiryDays = (): number => {
  const configured = env('NEXT_PRIVATE_SIGNUP_INVITE_EXPIRY_DAYS');

  if (!configured) {
    return DEFAULT_SIGNUP_INVITE_EXPIRY_DAYS;
  }

  const parsed = Number.parseInt(configured, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_SIGNUP_INVITE_EXPIRY_DAYS;
  }

  return Math.min(parsed, MAX_SIGNUP_INVITE_EXPIRY_DAYS);
};

export const resolveSignupInviteExpiryDays = (expiresInDays?: number): number => {
  if (expiresInDays === undefined) {
    return getDefaultSignupInviteExpiryDays();
  }

  if (expiresInDays < 1) {
    return 1;
  }

  return Math.min(expiresInDays, MAX_SIGNUP_INVITE_EXPIRY_DAYS);
};

export const computeSignupInviteExpiresAt = (expiresInDays: number): Date => {
  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  return expiresAt;
};
