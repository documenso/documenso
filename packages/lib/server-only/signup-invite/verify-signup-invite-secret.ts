import { timingSafeEqual } from 'node:crypto';

import { getSignupInviteSecret } from './is-signup-invite-secret-configured';

const parseAuthorizationSecret = (authorizationHeader: string | null | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [token] = authorizationHeader.split('Bearer ').filter((part) => part.length > 0);

  if (!token) {
    return null;
  }

  return token.trim();
};

const areSecretsEqual = (providedSecret: string, configuredSecret: string): boolean => {
  const providedBuffer = Buffer.from(providedSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
};

export const verifySignupInviteSecret = (authorizationHeader: string | null | undefined): boolean => {
  const configuredSecret = getSignupInviteSecret();

  if (!configuredSecret) {
    return false;
  }

  const providedSecret = parseAuthorizationSecret(authorizationHeader);

  if (!providedSecret) {
    return false;
  }

  return areSecretsEqual(providedSecret, configuredSecret);
};
