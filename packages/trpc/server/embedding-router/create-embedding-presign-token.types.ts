import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const createEmbeddingPresignTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/embedding/create-presign-token',
    summary: 'Create embedding presign token',
    description:
      'Creates a presign token for embedding operations with configurable expiration time',
    tags: ['Embedding'],
  },
};

export const ZCreateEmbeddingPresignTokenRequestSchema = z.object({
  expiresIn: z
    .number()
    .min(0)
    .max(10080)
    .optional()
    .default(60)
    .describe('Expiration time in minutes (default: 60, max: 10,080)'),
});

export const ZCreateEmbeddingPresignTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.date(),
  expiresIn: z.number().describe('Expiration time in seconds'),
});

export type TCreateEmbeddingPresignTokenRequestSchema = z.infer<
  typeof ZCreateEmbeddingPresignTokenRequestSchema
>;

export type TCreateEmbeddingPresignTokenResponseSchema = z.infer<
  typeof ZCreateEmbeddingPresignTokenResponseSchema
>;
