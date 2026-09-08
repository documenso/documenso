import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';

/**
 * Builds the enrolment redirect for an instance-blocked user, carrying the
 * current path so they land back where they were after enrolling.
 *
 * Shared by the server-side `twoFactorEnforcementMiddleware` and the
 * client-side redirect in the authenticated layout.
 */
export const buildTwoFactorOnboardingPath = (currentPath: string) => {
  const returnTo = (isValidReturnTo(currentPath) && normalizeReturnTo(currentPath)) || '/';

  return `/onboarding/2fa?returnTo=${encodeURIComponent(returnTo)}`;
};
