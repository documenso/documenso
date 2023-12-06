import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

/* 
  These schemas should be moved from here probably.
  It grows quickly.
*/
const GetDocumentsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const DocumentSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  status: z.string(),
  documentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

const SendDocumentForSigningMutationSchema = z.object({
  signerEmail: z.string(),
  signerName: z.string().optional(),
});

const UploadDocumentSuccessfulSchema = z.object({
  uploadedFile: z.object({
    id: z.number(),
    message: z.string(),
  }),
});

const SuccessfulResponseSchema = z.object({
  documents: DocumentSchema.array(),
  totalPages: z.number(),
});

const UnsuccessfulResponseSchema = z.object({
  message: z.string(),
});

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
        200: DocumentSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
      },
      summary: 'Get a single document',
    },
    deleteDocument: {
      method: 'DELETE',
      path: `/documents/:id`,
      body: z.string(),
      responses: {
        200: DocumentSchema,
        401: UnsuccessfulResponseSchema,
        404: UnsuccessfulResponseSchema,
      },
      summary: 'Delete a document',
    },
    createDocument: {
      method: 'POST',
      path: '/documents',
      contentType: 'multipart/form-data',
      body: c.type<{ file: File }>(),
      responses: {
        200: UploadDocumentSuccessfulSchema,
        401: UnsuccessfulResponseSchema,
        500: UnsuccessfulResponseSchema,
      },
      summary: 'Upload a new document',
    },
  },
  {
    baseHeaders: z.object({
      authorization: z.string(),
    }),
  },
);
