import type { NextRequest } from 'next/server';

import { i18nRouter } from 'next-i18n-router';

import i18nConfig from '../i18nConfig';

export default function middleware(request: NextRequest) {
  return i18nRouter(request, i18nConfig);
}
export const config = {
  matcher: '/((?!api|static|.*\\..*|_next).*)',
};
