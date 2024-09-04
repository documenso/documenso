import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { extractLocaleData } from '@documenso/lib/utils/i18n';

export default function middleware(req: NextRequest) {
  const { lang } = extractLocaleData({
    headers: req.headers,
    cookies: cookies(),
  });

  const response = NextResponse.next();

  response.cookies.set('i18n', lang);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - ingest (analytics)
     * - site.webmanifest
     */
    {
      source: '/((?!api|_next/static|_next/image|ingest|favicon|site.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
