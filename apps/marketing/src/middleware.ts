import type { NextRequest } from 'next/server';

import { withInternationalization } from '@documenso/lib/internationalization';

function middleware(request: NextRequest) {}

export default withInternationalization(middleware);

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
