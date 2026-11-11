import { shouldUseSecureCookies } from '@documenso/lib/constants/auth';
import { createCookie } from 'react-router';

export const userPreferencesCookie = createCookie('user-preferences', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  httpOnly: true,
  sameSite: 'lax',
  secure: shouldUseSecureCookies(),
});
