import { generateOpenApi } from '@ts-rest/open-api';

import { ApiContractV1 } from './contract';

const generatedOpenApi = generateOpenApi(
  ApiContractV1,
  {
    info: {
      title: 'Documenso API',
      version: '1.0.0',
      description: 'The Documenso API for retrieving, creating, updating and deleting documents.',
    },
  },
  {
    setOperationId: true,
  },
);

export const OpenAPIV1 = {
  ...generatedOpenApi,
  components: {
    securitySchemes: {
      authorization: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      },
    },
  },
  security: [
    {
      authorization: [],
    },
  ],
};
