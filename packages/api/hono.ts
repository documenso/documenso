import { TsRestHttpError, fetchRequestHandler } from '@ts-rest/serverless/fetch';
import { Hono } from 'hono';

import { ApiContractV1 } from '@documenso/api/v1/contract';
import { ApiContractV1Implementation } from '@documenso/api/v1/implementation';
import { OpenAPIV1 } from '@documenso/api/v1/openapi';
import { testCredentialsHandler } from '@documenso/lib/server-only/public-api/test-credentials';
import { listDocumentsHandler } from '@documenso/lib/server-only/webhooks/zapier/list-documents';
import { subscribeHandler } from '@documenso/lib/server-only/webhooks/zapier/subscribe';
import { unsubscribeHandler } from '@documenso/lib/server-only/webhooks/zapier/unsubscribe';

// This is bad, ts-router will be created on each request.
// But don't really have a choice here.
export const tsRestHonoApp = new Hono();

tsRestHonoApp
  .get('/openapi', (c) => c.redirect('https://openapi-v1.documenso.com'))
  .get('/openapi.json', (c) => c.json(OpenAPIV1))
  .get('/me', async (c) => testCredentialsHandler(c.req.raw));

// Zapier. Todo: (RR7) Check methods. Are these get/post/update requests?
tsRestHonoApp
  .all('/zapier/list-documents', async (c) => listDocumentsHandler(c.req.raw))
  .all('/zapier/subscribe', async (c) => subscribeHandler(c.req.raw))
  .all('/zapier/unsubscribe', async (c) => unsubscribeHandler(c.req.raw));

tsRestHonoApp.mount('/', async (request) => {
  return fetchRequestHandler({
    request,
    contract: ApiContractV1,
    router: ApiContractV1Implementation,
    options: {
      errorHandler: (err) => {
        if (err instanceof TsRestHttpError && err.statusCode === 500) {
          console.error(err);
        }
      },
    },
  });
});
