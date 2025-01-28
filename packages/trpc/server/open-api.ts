import { generateOpenApiDocument } from 'trpc-to-openapi';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { appRouter } from './router';

export const openApiDocument = {
  ...generateOpenApiDocument(appRouter, {
    title: 'Documenso v2 beta API',
    description: 'Subject to breaking changes until v2 is fully released.',
    version: '0.0.0',
    baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta`,
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      },
    },
  }),

  /**
   * Dirty way to pass through the security field.
   */
  security: [
    {
      apiKey: [],
    },
  ],
};
