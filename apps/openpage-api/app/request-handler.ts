import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type RouteHandler<T = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: { params: T },
) => Promise<Response> | Response;

function isAllowedOrigin(req: NextRequest): boolean {
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (referer && host) {
    const refererUrl = new URL(referer);
    return refererUrl.host === host;
  }

  if (host?.includes('localhost')) {
    return true;
  }

  return false;
}

export function requestHandler<T = Record<string, string | string[]>>(
  handler: RouteHandler<T>,
): RouteHandler<T> {
  return async (req: NextRequest, ctx: { params: T }) => {
    try {
      if (!isAllowedOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const result = await handler(req, ctx);

      return result;
    } catch (error) {
      console.log(error);

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}
