/**
 * Read a cookie value from `document.cookie`.
 *
 * Client-side counterpart of `extractCookieFromHeaders`. Only works for cookies that
 * are not `HttpOnly`, such as the preferred team URL cookie.
 */
export const extractCookieFromDocument = (cookieName: string): string | null => {
  const cookiePairs = document.cookie.split(';');

  const cookie = cookiePairs.find((pair) => pair.trim().startsWith(`${cookieName}=`));

  if (!cookie) {
    return null;
  }

  return cookie.split('=')[1].trim();
};
