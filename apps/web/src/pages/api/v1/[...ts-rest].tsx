import type { NextApiRequest, NextApiResponse } from 'next';

import { getDocuments } from '@documenso/lib/server-only/public-api/get-documents';
import { contract } from '@documenso/trpc/api-contract/contract';
import { createNextRoute, createNextRouter } from '@documenso/trpc/server/public-api/ts-rest';

const router = createNextRoute(contract, {
  getDocuments: async (args) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    const { documents, totalPages } = await getDocuments({ page, perPage });

    return {
      status: 200,
      body: {
        documents,
        totalPages,
      },
    };
  },
});

const nextRouter = createNextRouter(contract, router);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await nextRouter(req, res);
}
