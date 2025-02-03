import { createCookieSessionStorage } from 'react-router';
import { createThemeSessionResolver } from 'remix-themes';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

const themeSessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'theme',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secrets: ['insecure-secret'], // Todo: Don't need secret
    // Todo: Check this works on production.
    // Set domain and secure only if in production
    ...(import.meta.env.PROD ? { domain: NEXT_PUBLIC_WEBAPP_URL(), secure: true } : {}),
  },
});

export const themeSessionResolver = createThemeSessionResolver(themeSessionStorage);
