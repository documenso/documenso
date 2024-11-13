import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';

const paths = [
  { path: '/total-customers', description: 'Total Customers' },
  { path: '/total-users', description: 'Total Users' },
  { path: '/new-users', description: 'New Users' },
  { path: '/completed-documents', description: 'Completed Documents per Month' },
  { path: '/total-completed-documents', description: 'Total Completed Documents' },
  { path: '/signer-conversion', description: 'Signers That Signed Up' },
  { path: '/total-signer-conversion', description: 'Total Signers That Signed Up' },
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
