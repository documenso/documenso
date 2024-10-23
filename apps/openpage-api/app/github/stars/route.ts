import { NextResponse } from 'next/server';

import { requestHandler } from '@/app/request-handler';

export const GET = requestHandler(async () => {
  const res = await fetch('https://api.github.com/repos/documenso/documenso');
  const { stargazers_count } = await res.json();

  return NextResponse.json({
    data: stargazers_count,
  });
});
