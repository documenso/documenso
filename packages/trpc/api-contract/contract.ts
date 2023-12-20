import { initContract } from '@ts-rest/core';

import {
  AuthorizationHeadersSchema,
  CreateDocumentMutationSchema,
  DeleteDocumentMutationSchema,
  GetDocumentsQuerySchema,
  SendDocumentForSigningMutationSchema,
  SuccessfulDocumentResponseSchema,
  SuccessfulResponseSchema,
  SuccessfulSigningResponseSchema,
  UnsuccessfulResponseSchema,
  UploadDocumentSuccessfulSchema,
} from './schema';

const c = initContract();

export const contract = c.router(
  {
    getDocuments: {
      method: 'GET',
      path: '/documents',
      query: GetDocumentsQuerySchema,
      responses: {
        200: SuccessfulResponseSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
      },
      summary: 'Get all documents',
    },
    getDocument: {
      method: 'GET',
      path: `/documents/:id`,
      responses: {
        200: SuccessfulDocumentResponseSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
      },
      summary: 'Get a single document',
    },
    createDocument: {
      method: 'POST',
      path: '/documents',
      body: CreateDocumentMutationSchema,
      responses: {
        200: UploadDocumentSuccessfulSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
      },
      summary: 'Upload a new document and get a presigned URL',
    },
    sendDocumentForSigning: {
      method: 'PATCH',
      path: '/documents/:id/send',
      body: SendDocumentForSigningMutationSchema,
      responses: {
        200: SuccessfulSigningResponseSchema,
        400: UnsuccessfulResponseSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
        500: UnsuccessfulResponseSchema,
      },
      summary: 'Send a document for signing',
    },
    deleteDocument: {
      method: 'DELETE',
      path: `/documents/:id`,
      body: DeleteDocumentMutationSchema,
      responses: {
        200: SuccessfulDocumentResponseSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
      },
      summary: 'Delete a document',
    },
  },
  {
    baseHeaders: AuthorizationHeadersSchema,
  },
);
