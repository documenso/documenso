import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import type { RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import { tsRestHonoApp } from '@documenso/api/hono';
import { auth } from '@documenso/auth/server';
import { API_V2_BETA_URL, API_V2_URL } from '@documenso/lib/constants/app';
import { jobsClient } from '@documenso/lib/jobs/client';
import { TelemetryClient } from '@documenso/lib/server-only/telemetry/telemetry-client';
import { getIpAddress } from '@documenso/lib/universal/get-ip-address';
import { logger } from '@documenso/lib/utils/logger';
import { openApiDocument } from '@documenso/trpc/server/open-api';

import { downloadRoute } from './api/download/download';
import { filesRoute } from './api/files/files';
import { type AppContext, appContext } from './context';
import { appMiddleware } from './middleware';
import { openApiTrpcServerHandler } from './trpc/hono-trpc-open-api';
import { reactRouterTrpcServer } from './trpc/hono-trpc-remix';

export interface HonoEnv {
  Variables: RequestIdVariables & {
    context: AppContext;
    logger: Logger;
  };
}

const app = new Hono<HonoEnv>();

/**
 * Rate limiting for v1 and v2 API routes only.
 * - 100 requests per minute per IP address
 */
const rateLimitMiddleware = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // 100 requests per window
  keyGenerator: (c) => {
    try {
      return getIpAddress(c.req.raw);
    } catch (error) {
      return 'unknown';
    }
  },
  message: {
    error: 'Too many requests, please try again later.',
  },
});

/**
 * Attach session and context to requests.
 */
app.use(contextStorage());
app.use(appContext);

/**
 * RR7 app middleware.
 */
app.use('*', appMiddleware);
app.use('*', requestId());
app.use(async (c, next) => {
  const metadata = c.get('context').requestMetadata;

  const honoLogger = logger.child({
    requestId: c.var.requestId,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  c.set('logger', honoLogger);

  await next();
});

// Apply rate limit to /api/v1/*
app.use('/api/v1/*', rateLimitMiddleware);
app.use('/api/v2/*', rateLimitMiddleware);

// Auth server.
app.route('/api/auth', auth);

// Files route.
app.route('/api/files', filesRoute);

// API servers.
app.use(`/api/v1/*`, cors());
app.route('/api/v1', tsRestHonoApp);
app.use('/api/jobs/*', jobsClient.getApiHandler());
app.use('/api/trpc/*', reactRouterTrpcServer);

// Unstable API server routes. Order matters for these two.
app.get(`${API_V2_URL}/openapi.json`, (c) => c.json(openApiDocument));
app.use(`${API_V2_URL}/*`, cors());
// Shadows the download routes that tRPC defines since tRPC-to-openapi doesn't support their return types.
app.route(`${API_V2_URL}`, downloadRoute);
app.use(`${API_V2_URL}/*`, async (c) =>
  openApiTrpcServerHandler(c, {
    isBeta: false,
  }),
);

// Unstable API server routes. Order matters for these two.
app.get(`${API_V2_BETA_URL}/openapi.json`, (c) => c.json(openApiDocument));
app.use(`${API_V2_BETA_URL}/*`, cors());
// Shadows the download routes that tRPC defines since tRPC-to-openapi doesn't support their return types.
app.route(`${API_V2_BETA_URL}`, downloadRoute);
app.use(`${API_V2_BETA_URL}/*`, async (c) =>
  openApiTrpcServerHandler(c, {
    isBeta: true,
  }),
);

// Start telemetry client for anonymous usage tracking.
// Can be disabled by setting DOCUMENSO_DISABLE_TELEMETRY=true
void TelemetryClient.start();

export default app;
