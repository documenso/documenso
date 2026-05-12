import { getContext } from 'hono/context-storage';
import type { AppLoadContext } from 'react-router';

import type { HonoEnv } from './router';
import { CSP_NONCE_KEY } from './security-headers';

/**
 * Augment React Router's `AppLoadContext` so loaders, actions, and
 * `entry.server` can access fields by name without casts.
 */
declare module 'react-router' {
  interface AppLoadContext {
    /**
     * Per-request CSP nonce. Populated by `securityHeadersMiddleware` and surfaced here
     * so it can be threaded into `<ServerRouter nonce>` and root loader
     * data, which then feeds `<Scripts>`, `<Links>`, etc.
     */
    nonce: string;
  }
}

/**
 * Builds the React Router `AppLoadContext` for both dev (vite plugin) and
 * production (`hono-react-router-adapter/node`).
 *
 * The Hono context isn't passed directly by the adapter, so we read it via
 * `hono/context-storage`, which is enabled in `server/router.ts`.
 */
export const getLoadContext = (): AppLoadContext => {
  const nonce = getContext<HonoEnv>().var[CSP_NONCE_KEY] ?? '';

  return { nonce };
};
