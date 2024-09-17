import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getToken } from 'next-auth/jwt';

import { TEAM_URL_ROOT_REGEX } from '@documenso/lib/constants/teams';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';

async function middleware(req: NextRequest): Promise<NextResponse> {
  const preferredTeamUrl = cookies().get('preferred-team-url');

  const referrer = req.headers.get('referer');
  const referrerUrl = referrer ? new URL(referrer) : null;
  const referrerPathname = referrerUrl ? referrerUrl.pathname : null;

  // Whether to reset the preferred team url cookie if the user accesses a non team page from a team page.
  const resetPreferredTeamUrl =
    referrerPathname &&
    referrerPathname.startsWith('/t/') &&
    (!req.nextUrl.pathname.startsWith('/t/') || req.nextUrl.pathname === '/');

  // Redirect root page to `/documents` or `/t/{preferredTeamUrl}/documents`.
  if (req.nextUrl.pathname === '/') {
    const redirectUrlPath = formatDocumentsPath(
      resetPreferredTeamUrl ? undefined : preferredTeamUrl?.value,
    );

    const redirectUrl = new URL(redirectUrlPath, req.url);
    const response = NextResponse.redirect(redirectUrl);

    return response;
  }

  // Redirect `/t` to `/settings/teams`.
  if (req.nextUrl.pathname === '/t') {
    const redirectUrl = new URL('/settings/teams', req.url);

    return NextResponse.redirect(redirectUrl);
  }

  // Redirect `/t/<team_url>` to `/t/<team_url>/documents`.
  if (TEAM_URL_ROOT_REGEX.test(req.nextUrl.pathname)) {
    const redirectUrl = new URL(`${req.nextUrl.pathname}/documents`, req.url);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('preferred-team-url', req.nextUrl.pathname.replace('/t/', ''));

    return response;
  }

  // Set the preferred team url cookie if user accesses a team page.
  if (req.nextUrl.pathname.startsWith('/t/')) {
    const response = NextResponse.next();
    response.cookies.set('preferred-team-url', req.nextUrl.pathname.split('/')[2]);

    return response;
  }

  if (req.nextUrl.pathname.startsWith('/signin')) {
    const token = await getToken({ req });

    if (token) {
      const redirectUrl = new URL('/documents', req.url);

      return NextResponse.redirect(redirectUrl);
    }
  }

  // Clear preferred team url cookie if user accesses a non team page from a team page.
  if (resetPreferredTeamUrl || req.nextUrl.pathname === '/documents') {
    const response = NextResponse.next();
    response.cookies.set('preferred-team-url', '');

    return response;
  }

  if (req.nextUrl.pathname.startsWith('/embed')) {
    const res = NextResponse.next();

    // Allow third parties to iframe the document.
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Content-Security-Policy', 'frame-ancestors *');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'ALLOW-ALL');

    return res;
  }

  return NextResponse.next();
}

export default async function middlewareWrapper(req: NextRequest) {
  const response = await middleware(req);

  // Can place anything that needs to be set on the response here.

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
