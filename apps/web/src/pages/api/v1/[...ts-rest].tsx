import type { NextApiRequest, NextApiResponse } from 'next';

import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
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
  getDocument: async (args) => {
    const document = await getDocumentById(args.params.id);

    return {
      status: 200,
      body: document,
    };
  },
});

const nextRouter = createNextRouter(contract, router);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await nextRouter(req, res);
}
