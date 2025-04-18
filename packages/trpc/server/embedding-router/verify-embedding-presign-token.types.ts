import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const verifyEmbeddingPresignTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/embedding/verify-presign-token',
    summary: 'Verify embedding presign token',
    description:
      'Verifies a presign token for embedding operations and returns the associated API token',
    tags: ['Embedding'],
  },
};

export const ZVerifyEmbeddingPresignTokenRequestSchema = z.object({
  token: z
    .string()
    .min(1, { message: 'Token is required' })
    .describe('The presign token to verify'),
});

export const ZVerifyEmbeddingPresignTokenResponseSchema = z.object({
  success: z.boolean(),
});

export type TVerifyEmbeddingPresignTokenRequestSchema = z.infer<
  typeof ZVerifyEmbeddingPresignTokenRequestSchema
>;

export type TVerifyEmbeddingPresignTokenResponseSchema = z.infer<
  typeof ZVerifyEmbeddingPresignTokenResponseSchema
>;
