import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const GetDocumentsQuery = z.object({
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

const SuccessfulResponse = z.object({
  documents: DocumentSchema.array(),
  totalPages: z.number(),
});

export const contract = c.router(
  {
    getDocuments: {
      method: 'GET',
      path: '/documents',
      query: GetDocumentsQuery,
      responses: {
        200: SuccessfulResponse,
      },
      summary: 'Get all documents',
    },
    getDocument: {
      method: 'GET',
      path: `/documents/:id`,
      responses: {
        200: DocumentSchema,
      },
      summary: 'Get a single document',
    },
  },
  {
    baseHeaders: z.object({
      authorization: z.string(),
    }),
  },
);
