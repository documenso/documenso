import { headers } from 'next/headers';

import { getAllFlags, getFlag } from '@documenso/lib/universal/get-feature-flag';

/**
 * Evaluate whether a flag is enabled for the current user in a server component.
 *
 * @param flag The flag to evaluate.
 * @returns Whether the flag is enabled, or the variant value of the flag.
 */
export const getServerComponentFlag = async (flag: string) => {
  return await getFlag(flag, {
    requestHeaders: Object.fromEntries(headers().entries()),
  });
};

/**
 * Get all feature flags for the current user from a server component.
 *
 * @returns A record of flags and their values for the user derived from the headers.
 */
export const getServerComponentAllFlags = async () => {
  return await getAllFlags({
    requestHeaders: Object.fromEntries(headers().entries()),
  });
};
