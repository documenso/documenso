import { NextApiResponse } from 'next';
import { NextResponse } from 'next/server';

type NarrowedResponse<T> = T extends NextResponse
  ? NextResponse
  : T extends NextApiResponse<infer U>
  ? NextApiResponse<U>
  : never;

export const withStaleWhileRevalidate = <T>(
  res: NarrowedResponse<T>,
  cacheInSeconds = 60,
  staleCacheInSeconds = 300,
) => {
  if ('headers' in res) {
    res.headers.set(
      'Cache-Control',
      `public, s-maxage=${cacheInSeconds}, stale-while-revalidate=${staleCacheInSeconds}`,
    );
  } else {
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheInSeconds}, stale-while-revalidate=${staleCacheInSeconds}`,
    );
  }

  return res;
};
