import { createCookie } from 'react-router';

export const langCookie = createCookie('lang', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365 * 2,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
});
