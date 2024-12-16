import { generateOpenApiDocument } from 'trpc-openapi';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { appRouter } from './router';

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Do not use.',
  version: '0.0.0',
  baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/beta`,
  // docsUrl: '', // Todo
});
