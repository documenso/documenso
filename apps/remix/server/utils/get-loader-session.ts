import { getContext } from 'hono/context-storage';
import type { AppContext } from 'server/context';
import type { HonoEnv } from 'server/router';

/**
 * Get the full context passed to the loader.
 *
 * @returns The full app context.
 */
export const getOptionalLoaderContext = (): AppContext => {
  const { context } = getContext<HonoEnv>().var;
  return context;
};
