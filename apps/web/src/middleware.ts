import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getToken } from 'next-auth/jwt';

const todoRegex = new RegExp('^/t/[^/]+$');

export default async function middleware(req: NextRequest) {
  const preferredTeamUrl = cookies().get('preferred-team-url');

  // Redirect to preferred team if user has selected one.
  if (
    !req.url &&
    (req.nextUrl.pathname === '/' || req.nextUrl.pathname === '/documents') &&
    preferredTeamUrl?.value
  ) {
    const redirectUrl = new URL(`/t/${preferredTeamUrl.value}`, req.url);

    return NextResponse.redirect(redirectUrl);
  }

  // Redirect `/t/<team_url>` to `/t/<team_url>/documents`
  if (todoRegex.test(req.nextUrl.pathname)) {
    const redirectUrl = new URL(`${req.nextUrl.pathname}/documents`, req.url);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('preferred-team-url', req.nextUrl.pathname.replace('/t/', ''));

    return response;
  }

  if (req.nextUrl.pathname === '/t') {
    const redirectUrl = new URL('/settings/teams', req.url);

    return NextResponse.redirect(redirectUrl);
  }

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

  return NextResponse.next();
}
