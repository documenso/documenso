import { remember } from '@epic-web/remember';
import { type HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { reactRouter } from 'remix-hono/handler';

type Bindings = HttpBindings;

const app = new Hono<{ Bindings: Bindings }>();

const isProduction = process.env.NODE_ENV === 'production';

const viteDevServer = isProduction
  ? undefined
  : await import('vite').then(async (vite) =>
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
      : async () => viteDevServer!.ssrLoadModule('virtual:react-router/server-build'),
  }),
);

// app.get('/', (c) => c.text('Hello, world!'));
if (viteDevServer) {
  app.use('*', async (c, next) => {
    return new Promise((resolve) => {
      viteDevServer.middlewares(c.env.incoming, c.env.outgoing, () => resolve(next()));
    });
  });
}

app.use('*', async (c, next) => {
  const middleware = await reactRouterMiddleware;

  return middleware(c, next);
});

export default app;
