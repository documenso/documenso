import { type NextRequest, NextResponse } from 'next/server';

const paths = [{ path: 'github', description: 'GitHub Data' }];

export function GET(request: NextRequest) {
  const url = request.nextUrl.toString();
  const apis = paths.map(({ path, description }) => {
    return { path: url + path, description };
  });

  return NextResponse.json(apis, {
    status: 200,
    headers: {
      // TODO: Update for marketing page
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
