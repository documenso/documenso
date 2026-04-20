import { generateOpenApi } from '@ts-rest/open-api';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { ApiContractV1 } from './contract';

export const OpenAPIV1 = Object.assign(
  generateOpenApi(
    ApiContractV1,
    {
      info: {
        title: 'Documenso API',
        version: '1.0.0',
        description:
          'API V1 is deprecated, but will continue to be supported. For more details, see https://docs.documenso.com/developers/public-api. \n\nThe Documenso API for retrieving, creating, updating and deleting documents.',
      },
      servers: [
        {
          url: NEXT_PUBLIC_WEBAPP_URL(),
        },
      ],
    },
    {
      setOperationId: true,
    },
  ),
  {
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
  },
);
