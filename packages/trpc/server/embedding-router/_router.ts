import { router } from '../trpc';
import { createEmbeddingDocumentRoute } from './create-embedding-document';
import { createEmbeddingPresignTokenRoute } from './create-embedding-presign-token';
import { createEmbeddingTemplateRoute } from './create-embedding-template';
import { getEmbeddingDocumentRoute } from './get-embedding-document';
import { verifyEmbeddingPresignTokenRoute } from './verify-embedding-presign-token';

export const embeddingPresignRouter = router({
  createEmbeddingPresignToken: createEmbeddingPresignTokenRoute,
  verifyEmbeddingPresignToken: verifyEmbeddingPresignTokenRoute,
  createEmbeddingDocument: createEmbeddingDocumentRoute,
  createEmbeddingTemplate: createEmbeddingTemplateRoute,
  getEmbeddingDocument: getEmbeddingDocumentRoute,
});
