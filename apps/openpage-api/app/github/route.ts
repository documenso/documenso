import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';

const paths = [
  { path: '/forks', description: 'GitHub Forks' },
  { path: '/stars', description: 'GitHub Stars' },
  { path: '/issues', description: 'GitHub Merged Issues' },
  { path: '/prs', description: 'GitHub Pull Requests' },
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
