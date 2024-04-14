import type { NextApiRequest, NextApiResponse } from 'next';

import { OpenAPIV1 } from '@documenso/api/v1/openapi';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(OpenAPIV1);
}
