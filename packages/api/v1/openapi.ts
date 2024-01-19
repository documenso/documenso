import { generateOpenApi } from '@ts-rest/open-api';

import { ApiContractV1 } from './contract';

export const OpenAPIV1 = generateOpenApi(
  ApiContractV1,
  {
    info: {
      title: 'Documenso API',
      version: '1.0.0',
      description: 'Documenso API',
    },
  },
  {
    setOperationId: true,
  },
);
