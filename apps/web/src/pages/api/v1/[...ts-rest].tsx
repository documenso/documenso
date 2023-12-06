import type { NextApiRequest, NextApiResponse } from 'next';

import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getDocuments } from '@documenso/lib/server-only/public-api/get-documents';
import { checkUserFromToken } from '@documenso/lib/server-only/public-api/get-user-by-token';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { contract } from '@documenso/trpc/api-contract/contract';
import { createNextRoute, createNextRouter } from '@documenso/trpc/server/public-api/ts-rest';

const validateUserToken = async (token: string) => {
  try {
    return await checkUserFromToken({ token });
  } catch (e) {
    return null;
  }
};

const router = createNextRoute(contract, {
  getDocuments: async (args) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;
    const { authorization } = args.headers;

    const user = await validateUserToken(authorization);

    if (!user) {
      return {
        status: 401,
        body: {
          message: 'Unauthorized',
        },
      };
    }

    const { documents, totalPages } = await getDocuments({ page, perPage, userId: user.id });

    return {
      status: 200,
      body: {
        documents,
        totalPages,
      },
    };
  },
  getDocument: async (args) => {
    const { id: documentId } = args.params;
    const { authorization } = args.headers;

    const user = await validateUserToken(authorization);

    if (!user) {
      return {
        status: 401,
        body: {
          message: 'Unauthorized',
        },
      };
    }

    try {
      const document = await getDocumentById({ id: Number(documentId), userId: user.id });

      return {
        status: 200,
        body: document,
      };
    } catch (e) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  },
  deleteDocument: async (args) => {
    const { id: documentId } = args.params;
    const { authorization } = args.headers;

    const user = await validateUserToken(authorization);

    if (!user) {
      return {
        status: 401,
        body: {
          message: 'Unauthorized',
        },
      };
    }

    try {
      const document = await getDocumentById({ id: Number(documentId), userId: user.id });

      const deletedDocument = await deleteDocument({
        id: Number(documentId),
        userId: user.id,
        status: document.status,
      });

      return {
        status: 200,
        body: deletedDocument,
      };
    } catch (e) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  },
  createDocument: async (args) => {
    const { authorization } = args.headers;
    const { body } = args;

    const user = await validateUserToken(authorization);

    if (!user) {
      return {
        status: 401,
        body: {
          message: 'Unauthorized',
        },
      };
    }

    try {
      const regexPattern = /filename="(.+?)"/;
      const match = body.toString().match(regexPattern);
      const documentTitle = match?.[1] ?? 'Untitled document';

      console.log(body.toString());

      const file = new Blob([body.toString()], {
        type: 'application/pdf',
      });

      const { type, data } = await putFile(file);

      const { id: documentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createDocument({
        title: documentTitle,
        documentDataId,
        userId: user.id,
      });

      return {
        status: 200,
        body: {
          uploadedFile: {
            id,
            message: 'Document uploaded successfuly',
          },
        },
      };
    } catch (e) {
      console.error(e);
      return {
        status: 500,
        body: {
          message: 'An error occurred while uploading your document.',
        },
      };
    }
  },
});

const nextRouter = createNextRouter(contract, router);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await nextRouter(req, res);
}
