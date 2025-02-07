// main.ts
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import handle from 'hono-react-router-adapter/node';

import server from '.';
import * as build from '../build/server';

server.use(
  serveStatic({
    root: './build/client',
  }),
);

const handler = handle(build, server);

serve({ fetch: handler.fetch, port: 3000 });
