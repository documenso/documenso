import { NextRequest, NextResponse } from 'next/server';

export default async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/') {
    const redirectUrl = new URL('/documents', req.url);

    return NextResponse.redirect(redirectUrl);
  }

  // if (req.nextUrl.pathname.startsWith('/dashboard')) {
  //   const token = await getToken({ req });

  //   console.log('token', token);

  //   if (!token) {
  //     console.log('has no token', req.url);
  //     const redirectUrl = new URL('/signin', req.url);
  //     redirectUrl.searchParams.set('callbackUrl', req.url);

  //     return NextResponse.redirect(redirectUrl);
  //   }
  // }

  return NextResponse.next();
}
