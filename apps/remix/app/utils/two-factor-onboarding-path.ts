import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';

export const buildTwoFactorOnboardingPath = (currentPath: string) => {
  const returnTo = (isValidReturnTo(currentPath) && normalizeReturnTo(currentPath)) || '/';

  return `/onboarding/2fa?returnTo=${encodeURIComponent(returnTo)}`;
};
