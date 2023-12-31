import { initContract } from '@ts-rest/core';

import {
  ZSendDocumentForSigningMutationSchema as SendDocumentMutationSchema,
  ZAuthorizationHeadersSchema,
  ZCreateDocumentMutationSchema,
  ZDeleteDocumentMutationSchema,
  ZGetDocumentsQuerySchema,
  ZSuccessfulDocumentResponseSchema,
  ZSuccessfulResponseSchema,
  ZSuccessfulSigningResponseSchema,
  ZUnsuccessfulResponseSchema,
  ZUploadDocumentSuccessfulSchema,
} from './schema';

const c = initContract();

export const ApiContractV1 = c.router(
  {
    getDocuments: {
      method: 'GET',
      path: '/documents',
      query: ZGetDocumentsQuerySchema,
      responses: {
        200: ZSuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get all documents',
    },

    getDocument: {
      method: 'GET',
      path: `/documents/:id`,
      responses: {
        200: ZSuccessfulDocumentResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get a single document',
    },

    createDocument: {
      method: 'POST',
      path: '/documents',
      body: ZCreateDocumentMutationSchema,
      responses: {
        200: ZUploadDocumentSuccessfulSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Upload a new document and get a presigned URL',
    },

    sendDocument: {
      method: 'PATCH',
      path: '/documents/:id/send',
      body: SendDocumentMutationSchema,
      responses: {
        200: ZSuccessfulSigningResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Send a document for signing',
    },

    deleteDocument: {
      method: 'DELETE',
      path: `/documents/:id`,
      body: ZDeleteDocumentMutationSchema,
      responses: {
        200: ZSuccessfulDocumentResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a document',
    },
  },
  {
    baseHeaders: ZAuthorizationHeadersSchema,
  },
);
