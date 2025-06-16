import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

/**
 * Handle an optional redirect path.
 */
export const handleRequestRedirect = (redirectUrl?: string) => {
  if (!redirectUrl) {
    return;
  }

  const url = new URL(redirectUrl, NEXT_PUBLIC_WEBAPP_URL());

  if (url.origin !== NEXT_PUBLIC_WEBAPP_URL()) {
    window.location.href = '/';
  } else {
    window.location.href = redirectUrl;
  }
};

export const handleSignInRedirect = (redirectUrl: string = '/') => {
  const url = new URL(redirectUrl, NEXT_PUBLIC_WEBAPP_URL());

  if (url.origin !== NEXT_PUBLIC_WEBAPP_URL()) {
    window.location.href = '/';
  } else {
    window.location.href = redirectUrl;
  }
};
