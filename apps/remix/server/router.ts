import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { contextStorage } from 'hono/context-storage';

import { tsRestHonoApp } from '@documenso/api/hono';
import { auth } from '@documenso/auth/server';
import { API_V2_BETA_URL } from '@documenso/lib/constants/app';
import { jobsClient } from '@documenso/lib/jobs/client';
import { openApiDocument } from '@documenso/trpc/server/open-api';

import { filesRoute } from './api/files';
import { type AppContext, appContext } from './context';
import { appMiddleware } from './middleware';
import { openApiTrpcServerHandler } from './trpc/hono-trpc-open-api';
import { reactRouterTrpcServer } from './trpc/hono-trpc-remix';

export interface HonoEnv {
  Variables: {
    context: AppContext;
  };
}

const app = new Hono<HonoEnv>();

/**
 * Attach session and context to requests.
 */
app.use(contextStorage());
app.use(appContext);

/**
 * RR7 app middleware.
 */
app.use('*', appMiddleware);

/**
 * Rate limiting for all API routes.
 * - 100 requests per minute per IP address
 */
app.use(
  '/api/*',
  rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 100, // 100 requests per window
    keyGenerator: (c) => {
      // Use IP address for rate limiting
      return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    },
    message: {
      error: 'Too many requests, please try again later.',
    },
  }),
);

// Auth server.
app.route('/api/auth', auth);

// Files route.
app.route('/api/files', filesRoute);

// API servers.
app.route('/api/v1', tsRestHonoApp);
app.use('/api/jobs/*', jobsClient.getApiHandler());
app.use('/api/trpc/*', reactRouterTrpcServer);

// Unstable API server routes. Order matters for these two.
app.get(`${API_V2_BETA_URL}/openapi.json`, (c) => c.json(openApiDocument));
app.use(`${API_V2_BETA_URL}/*`, async (c) => openApiTrpcServerHandler(c));

export default app;
