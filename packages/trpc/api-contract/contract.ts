import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const GetDocumentsQuery = z.object({
  take: z.string().default('10'),
  skip: z.string().default('0'),
});

const DocumentSchema = z.object({
  id: z.string(),
  userId: z.number(),
  title: z.string(),
  status: z.string(),
  documentDataId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string(),
});

export const contract = c.router({
  getDocuments: {
    method: 'GET',
    path: '/documents',
    query: GetDocumentsQuery,
    responses: {
      200: DocumentSchema.array(),
    },
    summary: 'Get all documents for a user',
  },
});
