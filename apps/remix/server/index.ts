// server/index.ts
import { Hono } from 'hono';

import { auth } from '@documenso/auth/server';
import { jobsClient } from '@documenso/lib/jobs/client';

import { openApiTrpcServerHandler } from './trpc/hono-trpc-open-api';
import { reactRouterTrpcServer } from './trpc/hono-trpc-remix';

const app = new Hono();

// Auth server.
app.route('/api/auth', auth);

// API servers. Todo: Configure max durations, etc?
app.use('/api/jobs/*', jobsClient.getHonoApiHandler());
app.use('/api/v1/*', reactRouterTrpcServer); // Todo: ts-rest
app.use('/api/v2/*', async (c) => openApiTrpcServerHandler(c));
app.use('/api/trpc/*', reactRouterTrpcServer);

export default app;
