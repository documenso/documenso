import { initClient } from '@ts-rest/core';

import { ApiContractV1 } from '../contract';

const main = async () => {
  const client = initClient(ApiContractV1, {
    baseUrl: 'http://localhost:3000/api/v1',
    baseHeaders: {
      authorization: 'Bearer <my-token>',
    },
  });

  const documentId = '1';
  const fieldId = '1';

  const { status } = await client.deleteField({
    params: {
      id: documentId,
      fieldId,
    },
  });

  if (status !== 200) {
    throw new Error('Failed to remove field');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
