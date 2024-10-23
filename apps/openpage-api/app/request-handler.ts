import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type RouteHandler<T = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: { params: T },
) => Promise<Response> | Response;

const ALLOWED_ORIGINS = new Set(['documenso.com', 'prd-openpage-api.vercel.app']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function isAllowedOrigin(req: NextRequest): boolean {
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (host?.includes('localhost')) {
    return true;
  }

  if (!referer || !host) {
    return false;
  }

  try {
    const refererUrl = new URL(referer);
    const hostUrl = new URL(`http://${host}`);

    const isRefererAllowed = ALLOWED_ORIGINS.has(refererUrl.host);
    const isHostAllowed = ALLOWED_ORIGINS.has(hostUrl.host);

    return isRefererAllowed || isHostAllowed;
  } catch (error) {
    console.error('Error parsing URLs:', error);
    return false;
  }
}

export function requestHandler<T = Record<string, string | string[]>>(
  handler: RouteHandler<T>,
): RouteHandler<T> {
  return async (req: NextRequest, ctx: { params: T }) => {
    try {
      // if (!isAllowedOrigin(req)) {
      //   return NextResponse.json(
      //     { error: 'Forbidden' },
      //     {
      //       status: 403,
      //       headers: CORS_HEADERS,
      //     },
      //   );
      // }

      const response = await handler(req, ctx);

      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        {
          status: 500,
          headers: CORS_HEADERS,
        },
      );
    }
  };
}
