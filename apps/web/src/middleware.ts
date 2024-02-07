import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getToken } from 'next-auth/jwt';
import { i18nRouter } from 'next-i18n-router';

import i18nConfig from '../i18nConfig';

export default async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/') {
    const redirectUrl = new URL('/documents', req.url);

    return NextResponse.redirect(redirectUrl);
  }

  if (req.nextUrl.pathname.startsWith('/signin')) {
    const token = await getToken({ req });

    if (token) {
      const redirectUrl = new URL('/documents', req.url);

      return NextResponse.redirect(redirectUrl);
    }
  }

  return i18nRouter(req, i18nConfig);
}
export const config = {
  matcher: '/((?!api|static|.*\\..*|_next).*)',
};
