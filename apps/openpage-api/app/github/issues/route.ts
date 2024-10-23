import { NextResponse } from 'next/server';

import { requestHandler } from '@/app/request-handler';

export const GET = requestHandler(async () => {
  const res = await fetch(
    'https://api.github.com/search/issues?q=repo:documenso/documenso+type:issue+state:open&page=0&per_page=1',
  );
  const { total_count } = await res.json();

  return NextResponse.json({
    data: total_count,
  });
});
