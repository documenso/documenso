import { Hono } from 'hono';
import { PDFDocument } from 'pdf-lib';

import { tsRestHonoApp } from '@documenso/api/hono';
import { auth } from '@documenso/auth/server';
import { API_V2_BETA_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { jobsClient } from '@documenso/lib/jobs/client';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { getPresignGetUrl } from '@documenso/lib/universal/upload/server-actions';
import { openApiDocument } from '@documenso/trpc/server/open-api';

import { openApiTrpcServerHandler } from './trpc/hono-trpc-open-api';
import { reactRouterTrpcServer } from './trpc/hono-trpc-remix';

const app = new Hono();

// App middleware.
// app.use('*', appMiddleware);

// Auth server.
app.route('/api/auth', auth);

// API servers. Todo: Configure max durations, etc?
app.route('/api/v1', tsRestHonoApp);
app.use('/api/jobs/*', jobsClient.getApiHandler());
app.use('/api/trpc/*', reactRouterTrpcServer);

// Unstable API server routes. Order matters for these two.
app.get(`${API_V2_BETA_URL}/openapi.json`, (c) => c.json(openApiDocument));
app.use(`${API_V2_BETA_URL}/*`, async (c) => openApiTrpcServerHandler(c)); // Todo: Add next()?

// Temp uploader.
app
  .post('/api/file', async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // Add file size validation
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        return c.json({ error: 'File too large' }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();

      const pdf = await PDFDocument.load(arrayBuffer).catch((e) => {
        console.error(`PDF upload parse error: ${e.message}`);

        throw new AppError('INVALID_DOCUMENT_FILE');
      });

      if (pdf.isEncrypted) {
        throw new AppError('INVALID_DOCUMENT_FILE');
      }

      if (!file.name.endsWith('.pdf')) {
        file.name = `${file.name}.pdf`;
      }

      const { type, data } = await putFile(file);

      const result = await createDocumentData({ type, data });

      return c.json(result);
    } catch (error) {
      console.error('Upload failed:', error);
      return c.json({ error: 'Upload failed' }, 500);
    }
  })
  .get('/api/file', async (c) => {
    const key = c.req.query('key');

    const { url } = await getPresignGetUrl(key || '');

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get file "${key}", failed with status code ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    const binaryData = new Uint8Array(buffer);

    return c.json({
      binaryData,
    });
  });

export default app;
