import { NextRequest, NextResponse } from 'next/server';

import { getToken } from 'next-auth/jwt';

import { LOCAL_FEATURE_FLAGS } from '@documenso/lib/constants/feature-flags';
import PostHogServerClient from '@documenso/lib/server-only/feature-flags/get-post-hog-server-client';

import { extractDistinctUserId, mapJwtToFlagProperties } from './get';

/**
 * Get all the evaluated feature flags based on the current user if possible.
 */
export default async function handlerFeatureFlagAll(req: Request) {
  const requestHeaders = Object.fromEntries(req.headers.entries());

  const nextReq = new NextRequest(req, {
    headers: requestHeaders,
  });

  const token = await getToken({ req: nextReq });

  const postHog = PostHogServerClient();

  // Return the local feature flags if PostHog is not enabled, true by default.
  // The front end should not call this API if PostHog is not enabled to reduce network requests.
  if (!postHog) {
    return NextResponse.json(LOCAL_FEATURE_FLAGS);
  }

  const distinctId = extractDistinctUserId(token, nextReq);

  const featureFlags = await postHog.getAllFlags(distinctId, mapJwtToFlagProperties(token));

  const res = NextResponse.json(featureFlags);

  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const origin = req.headers.get('origin');

  if (origin) {
    if (origin.startsWith(process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'http://localhost:3000')) {
      res.headers.set('Access-Control-Allow-Origin', origin);
    }

    if (origin.startsWith(process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3001')) {
      res.headers.set('Access-Control-Allow-Origin', origin);
    }
  }

  return res;
}
