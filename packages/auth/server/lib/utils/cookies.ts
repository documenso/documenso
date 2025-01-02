/**
 * Todo: Use library for cookies instead.
 */
export const extractCookieFromHeaders = (cookieName: string, headers: Headers): string | null => {
  const cookieHeader = headers.get('cookie') || '';
  const cookiePairs = cookieHeader.split(';');
  const cookie = cookiePairs.find((pair) => pair.trim().startsWith(cookieName));

  if (!cookie) {
    return null;
  }

  return cookie.split('=')[1].trim();
};
