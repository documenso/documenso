import { createCookie } from 'react-router';

import { env } from '@documenso/lib/utils/env';

export const langCookie = createCookie('lang', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365 * 2,
  httpOnly: true,
  secure: env('NODE_ENV') === 'production',
});
