import type { NextApiRequest, NextApiResponse } from 'next';

import { createNextRouter } from '@documenso/api/next';
import { ApiContractV1 } from '@documenso/api/v1/contract';
import { ApiContractV1Implementation } from '@documenso/api/v1/implementation';

const nextRouteHandler = createNextRouter(ApiContractV1, ApiContractV1Implementation, {
  responseValidation: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: Dirty hack to make ts-rest handler work with next.js in a more intuitive way.
  req.query['ts-rest'] = Array.isArray(req.query['ts-rest']) ? req.query['ts-rest'] : []; // Make `ts-rest` an array.
  req.query['ts-rest'].unshift('api', 'v1'); // Prepend our base path to the array.

  return await nextRouteHandler(req, res);
}
