/**
 * This is the main entry point for the server which will launch the RR7 application
 * and spin up auth, api, etc.
 *
 * Note:
 *  This file will be copied to the build folder during build time.
 *  Running this file will not work without a build.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import handle from 'hono-react-router-adapter/node';

import { getLoadContext } from './hono/server/load-context.js';
import server from './hono/server/router.js';
import * as build from './index.js';

// Sub-path the app is served under (e.g. "/ESign"). Empty = root.
// Must match the basePath used by the Hono router and the Vite `base`/RR
// `basename` so that hashed asset URLs like `/ESign/assets/app-xxx.css`
// resolve to files on disk at `build/client/assets/app-xxx.css`.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

server.use(
  serveStatic({
    root: 'build/client',
    rewriteRequestPath: (path) => {
      if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
        const stripped = path.slice(basePath.length);
        return stripped === '' ? '/' : stripped;
      }
      return path;
    },
    onFound: (path, c) => {
      if (path.startsWith('build/client/assets')) {
        // Hard cache assets with hashed file names.
        c.header('Cache-Control', 'public, immutable, max-age=31536000');
      } else {
        // Cache with revalidation for rest of static files.
        c.header('Cache-Control', 'public, max-age=0, stale-while-revalidate=86400');
      }
    },
  }),
);

const handler = handle(build, server, { getLoadContext });

const port = parseInt(process.env.PORT || '3000', 10);

serve({ fetch: handler.fetch, port });
