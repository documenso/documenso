import type { NextApiRequest, NextApiResponse } from 'next';

import { openApiDocument } from '@documenso/trpc/server/open-api';

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
  res.status(200).send(openApiDocument);
};

export default handler;
