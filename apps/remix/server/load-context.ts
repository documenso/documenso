import { getContext } from 'hono/context-storage';
import { RouterContextProvider } from 'react-router';

import type { HonoEnv } from './router';
import { CSP_NONCE_KEY } from './security-headers';

/**
 * Per-request CSP nonce set by `securityHeadersMiddleware`, read via
 * `hono/context-storage` (enabled in `server/router.ts`).
 */
export const getRequestNonce = (): string => getContext<HonoEnv>().var[CSP_NONCE_KEY] ?? '';

/**
 * `future.v8_middleware` requires a `RouterContextProvider` instance here.
 */
export const getLoadContext = (): RouterContextProvider => new RouterContextProvider();
