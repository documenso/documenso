import type { NextApiRequest, NextApiResponse } from 'next';

import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { checkUserFromToken } from '@documenso/lib/server-only/public-api/get-user-by-token';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';
import { contract } from '@documenso/trpc/api-contract/contract';
import { createNextRoute, createNextRouter } from '@documenso/trpc/server/public-api/ts-rest';

const router = createNextRoute(contract, {
  getDocuments: async (args) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;
    const { authorization } = args.headers;
    let user;

    try {
      user = await checkUserFromToken({ token: authorization });
    } catch (e) {
      return {
        status: 401,
        body: {
          message: e.message,
        },
      };
    }

    const { data: documents, totalPages } = await findDocuments({ page, perPage, userId: user.id });

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
    let user;

    try {
      user = await checkUserFromToken({ token: authorization });
    } catch (e) {
      return {
        status: 401,
        body: {
          message: e.message,
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

    let user;

    try {
      user = await checkUserFromToken({ token: authorization });
    } catch (e) {
      return {
        status: 401,
        body: {
          message: e.message,
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
    const { body } = args;

    try {
      const { url, key } = await getPresignPostUrl(body.fileName, body.contentType);

      return {
        status: 200,
        body: {
          url,
          key,
        },
      };
    } catch (e) {
      return {
        status: 404,
        body: {
          message: 'An error has occured while uploading the file',
        },
      };
    }
  },
  sendDocumentForSigning: async (args) => {
    const { authorization } = args.headers;
    const { id } = args.params;
    const { body } = args;
    let user;

    try {
      user = await checkUserFromToken({ token: authorization });
    } catch (e) {
      return {
        status: 401,
        body: {
          message: e.message,
        },
      };
    }

    const document = await getDocumentById({ id: Number(id), userId: user.id });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === 'PENDING') {
      return {
        status: 400,
        body: {
          message: 'Document is already waiting for signing',
        },
      };
    }

    try {
      await setRecipientsForDocument({
        userId: user.id,
        documentId: Number(id),
        recipients: [
          {
            email: body.signerEmail,
            name: body.signerName ?? '',
          },
        ],
      });

      await setFieldsForDocument({
        documentId: Number(id),
        userId: user.id,
        fields: body.fields.map((field) => ({
          signerEmail: body.signerEmail,
          type: field.fieldType,
          pageNumber: field.pageNumber,
          pageX: field.pageX,
          pageY: field.pageY,
          pageWidth: field.pageWidth,
          pageHeight: field.pageHeight,
        })),
      });

      if (body.emailBody || body.emailSubject) {
        await upsertDocumentMeta({
          documentId: Number(id),
          subject: body.emailSubject ?? '',
          message: body.emailBody ?? '',
        });
      }

      await sendDocument({
        documentId: Number(id),
        userId: user.id,
      });

      return {
        status: 200,
        body: {
          message: 'Document sent for signing successfully',
        },
      };
    } catch (e) {
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
