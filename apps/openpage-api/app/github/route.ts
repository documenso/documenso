import { type NextRequest, NextResponse } from 'next/server';

const paths = [
  { path: '/forks', description: 'GitHub Forks' },
  { path: '/stars', description: 'GitHub Stars' },
  { path: '/issues', description: 'GitHub Merged Issues' },
  { path: '/prs', description: 'GitHub Pull Request' },
];

export function GET(request: NextRequest) {
  const url = request.nextUrl.toString();
  const apis = paths.map(({ path, description }) => {
    return { path: url + path, description };
  });

  return NextResponse.json(apis);
}
