import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';

const paths = [
  { path: 'github', description: 'GitHub Data' },
  { path: 'community', description: 'Community Data' },
  { path: 'growth', description: 'Growth Data' },
];

export function GET(request: NextRequest) {
  const url = request.nextUrl.toString();
  const apis = paths.map(({ path, description }) => {
    return { path: url + path, description };
  });

  return cors(
    request,
    new Response(JSON.stringify(apis), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    }),
  );
}

export function OPTIONS(request: Request) {
  return cors(
    request,
    new Response(null, {
      status: 204,
    }),
  );
}
