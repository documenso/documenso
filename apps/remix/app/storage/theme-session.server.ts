import { createCookieSessionStorage } from 'react-router';
import { createThemeSessionResolver } from 'remix-themes';

import { getCookieDomain, useSecureCookies } from '@documenso/lib/constants/auth';

const themeSessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'theme',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secrets: ['insecure-secret-do-not-care'],
    secure: useSecureCookies,
    domain: getCookieDomain(),
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const themeSessionResolver = createThemeSessionResolver(themeSessionStorage);
