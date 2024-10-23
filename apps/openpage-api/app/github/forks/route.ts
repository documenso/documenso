import { NextResponse } from 'next/server';

import { requestHandler } from '@/app/request-handler';

export const GET = requestHandler(async () => {
  const res = await fetch('https://api.github.com/repos/documenso/documenso');
  const { forks_count } = await res.json();

  return NextResponse.json({
    data: forks_count,
  });
});
