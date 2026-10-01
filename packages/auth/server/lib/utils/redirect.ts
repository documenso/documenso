import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

/**
 * Derive the default redirect target ("/" at the root, "/ESign/" when served under a sub-path).
 */
const getDefaultRedirect = () => {
  try {
    const pathname = new URL(NEXT_PUBLIC_WEBAPP_URL()).pathname.replace(/\/$/, '');
    return `${pathname}/`;
  } catch {
    return '/';
  }
};

const getWebAppOrigin = () => {
  try {
    return new URL(NEXT_PUBLIC_WEBAPP_URL()).origin;
  } catch {
    return NEXT_PUBLIC_WEBAPP_URL();
  }
};

/**
 * Handle an optional redirect path.
 */
export const handleRequestRedirect = (redirectUrl?: string) => {
  if (!redirectUrl) {
    return;
  }

  const url = new URL(redirectUrl, NEXT_PUBLIC_WEBAPP_URL());

  if (url.origin !== getWebAppOrigin()) {
    window.location.href = getDefaultRedirect();
  } else {
    window.location.href = redirectUrl;
  }
};

export const handleSignInRedirect = (redirectUrl?: string) => {
  const target = redirectUrl ?? getDefaultRedirect();
  const url = new URL(target, NEXT_PUBLIC_WEBAPP_URL());

  if (url.origin !== getWebAppOrigin()) {
    window.location.href = getDefaultRedirect();
  } else {
    window.location.href = target;
  }
};
