import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';

const paths = [
  { path: '/total-prs', description: 'Total GitHub Merged PRs' },
  { path: '/total-stars', description: 'Total GitHub Stars' },
  { path: '/total-forks', description: 'Total GitHub Forks' },
  { path: '/total-issues', description: 'Total GitHub Issues' },
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
