import { remember } from '@epic-web/remember';
import { type HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { reactRouter } from 'remix-hono/handler';

import { IS_APP_WEB } from '@documenso/lib/constants/app';

console.log({ IS_APP_WEB });

type Bindings = HttpBindings;

const isProduction = process.env.NODE_ENV === 'production';

const viteDevServer = isProduction
  ? undefined
  : import('vite').then(async (vite) =>
      vite.createServer({
        server: { middlewareMode: true },
      }),
    );

const reactRouterMiddleware = remember('reactRouterMiddleware', async () =>
  reactRouter({
    mode: isProduction ? 'production' : 'development',
    build: isProduction
      ? // @ts-expect-error build/server/index.js is a build artifact
        await import('../build/server/index.js')
      : async () => (await viteDevServer)!.ssrLoadModule('virtual:react-router/server-build'),
  }),
);

export const getApp = async () => {
  const app = new Hono<{ Bindings: Bindings }>();

  const resolvedDevServer = await viteDevServer;

  // app.get('/', (c) => c.text('Hello, world!'));
  if (resolvedDevServer) {
    app.use('*', async (c, next) => {
      return new Promise((resolve) => {
        resolvedDevServer.middlewares(c.env.incoming, c.env.outgoing, () => resolve(next()));
      });
    });
  }

  app.use('*', async (c, next) => {
    const middleware = await reactRouterMiddleware;

    return middleware(c, next);
  });

  return app;
};
