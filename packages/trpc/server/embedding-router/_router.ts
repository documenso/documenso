import { router } from '../trpc';
import { createEmbeddingDocumentRoute } from './create-embedding-document';
import { createEmbeddingPresignTokenRoute } from './create-embedding-presign-token';
import { createEmbeddingTemplateRoute } from './create-embedding-template';
import { getMultiSignDocumentRoute } from './get-multi-sign-document';
import { updateEmbeddingDocumentRoute } from './update-embedding-document';
import { updateEmbeddingTemplateRoute } from './update-embedding-template';
import { verifyEmbeddingPresignTokenRoute } from './verify-embedding-presign-token';

export const embeddingPresignRouter = router({
  createEmbeddingPresignToken: createEmbeddingPresignTokenRoute,
  verifyEmbeddingPresignToken: verifyEmbeddingPresignTokenRoute,
  createEmbeddingDocument: createEmbeddingDocumentRoute,
  createEmbeddingTemplate: createEmbeddingTemplateRoute,
  updateEmbeddingDocument: updateEmbeddingDocumentRoute,
  updateEmbeddingTemplate: updateEmbeddingTemplateRoute,
  // applyMultiSignSignature: applyMultiSignSignatureRoute,
  getMultiSignDocument: getMultiSignDocumentRoute,
});
