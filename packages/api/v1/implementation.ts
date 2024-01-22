import { createNextRoute } from '@ts-rest/next';

import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { setRecipientsForDocument } from '@documenso/lib/server-only/recipient/set-recipients-for-document';
import { getPresignPostUrl } from '@documenso/lib/universal/upload/server-actions';
import { DocumentStatus } from '@documenso/prisma/client';

import { ApiContractV1 } from './contract';
import { authenticatedMiddleware } from './middleware/authenticated';

export const ApiContractV1Implementation = createNextRoute(ApiContractV1, {
  getDocuments: authenticatedMiddleware(async (args, user) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    const { data: documents, totalPages } = await findDocuments({ page, perPage, userId: user.id });

    return {
      status: 200,
      body: {
        documents,
        totalPages,
      },
    };
  }),

  getDocument: authenticatedMiddleware(async (args, user) => {
    const { id: documentId } = args.params;

    try {
      const document = await getDocumentById({ id: Number(documentId), userId: user.id });

      return {
        status: 200,
        body: document,
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  }),

  deleteDocument: authenticatedMiddleware(async (args, user) => {
    const { id: documentId } = args.params;

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
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  }),

  createDocument: authenticatedMiddleware(async (args, _user) => {
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
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'An error has occured while uploading the file',
        },
      };
    }
  }),

  sendDocument: authenticatedMiddleware(async (args, user) => {
    const { id } = args.params;

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
      //   await setRecipientsForDocument({
      //     userId: user.id,
      //     documentId: Number(id),
      //     recipients: [
      //       {
      //         email: body.signerEmail,
      //         name: body.signerName ?? '',
      //       },
      //     ],
      //   });

      //   await setFieldsForDocument({
      //     documentId: Number(id),
      //     userId: user.id,
      //     fields: body.fields.map((field) => ({
      //       signerEmail: body.signerEmail,
      //       type: field.fieldType,
      //       pageNumber: field.pageNumber,
      //       pageX: field.pageX,
      //       pageY: field.pageY,
      //       pageWidth: field.pageWidth,
      //       pageHeight: field.pageHeight,
      //     })),
      //   });

      //   if (body.emailBody || body.emailSubject) {
      //     await upsertDocumentMeta({
      //       documentId: Number(id),
      //       subject: body.emailSubject ?? '',
      //       message: body.emailBody ?? '',
      //     });
      //   }

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
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while sending the document for signing',
        },
      };
    }
  }),

  createRecipient: authenticatedMiddleware(async (args, user) => {
    const { id: documentId } = args.params;
    const { name, email } = args.body;

    const document = await getDocumentById({
      id: Number(documentId),
      userId: user.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const recipients = await getRecipientsForDocument({
      documentId: Number(documentId),
      userId: user.id,
    });

    const recipientAlreadyExists = recipients.some((recipient) => recipient.email === email);

    if (recipientAlreadyExists) {
      return {
        status: 400,
        body: {
          message: 'Recipient already exists',
        },
      };
    }

    try {
      const newRecipients = await setRecipientsForDocument({
        documentId: Number(documentId),
        userId: user.id,
        recipients: [
          ...recipients,
          {
            email,
            name,
          },
        ],
      });

      const newRecipient = newRecipients.find((recipient) => recipient.email === email);

      if (!newRecipient) {
        throw new Error('Recipient not found');
      }

      return {
        status: 200,
        body: newRecipient,
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while creating the recipient',
        },
      };
    }
  }),
});
