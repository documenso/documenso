import { z } from 'zod';

import { LOCAL_FEATURE_FLAGS, isFeatureFlagEnabled } from '@documenso/lib/constants/feature-flags';

import { TFeatureFlagValue, ZFeatureFlagValueSchema } from '~/providers/feature-flag.types';

/**
 * Evaluate whether a flag is enabled for the current user.
 *
 * @param flag The flag to evaluate.
 * @param options See `GetFlagOptions`.
 * @returns Whether the flag is enabled, or the variant value of the flag.
 */
export const getFlag = async (
  flag: string,
  options?: GetFlagOptions,
): Promise<TFeatureFlagValue> => {
  const requestHeaders = options?.requestHeaders ?? {};

  if (!isFeatureFlagEnabled()) {
    return LOCAL_FEATURE_FLAGS[flag] ?? true;
  }

  const url = new URL(`${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/feature-flag/get`);
  url.searchParams.set('flag', flag);

  const response = await fetch(url, {
    headers: {
      ...requestHeaders,
    },
    next: {
      revalidate: 60,
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZFeatureFlagValueSchema.parse(res))
    .catch(() => false);

  return response;
};

/**
 * Get all feature flags for the current user if possible.
 *
 * @param options See `GetFlagOptions`.
 * @returns A record of flags and their values for the user derived from the headers.
 */
export const getAllFlags = async (
  options?: GetFlagOptions,
): Promise<Record<string, TFeatureFlagValue>> => {
  const requestHeaders = options?.requestHeaders ?? {};

  if (!isFeatureFlagEnabled()) {
    return LOCAL_FEATURE_FLAGS;
  }

  const url = new URL(`${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/feature-flag/all`);

  return fetch(url, {
    headers: {
      ...requestHeaders,
    },
    next: {
      revalidate: 60,
    },
  })
    .then(async (res) => res.json())
    .then((res) => z.record(z.string(), ZFeatureFlagValueSchema).parse(res))
    .catch(() => LOCAL_FEATURE_FLAGS);
};

interface GetFlagOptions {
  /**
   * The headers to attach to the request to evaluate flags.
   *
   * The authenticated user will be derived from the headers if possible.
   */
  requestHeaders: Record<string, string>;
}
