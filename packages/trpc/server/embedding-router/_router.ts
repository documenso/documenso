import { router } from '../trpc';
import { createEmbeddingDocumentRoute } from './create-embedding-document';
import { createEmbeddingEnvelopeRoute } from './create-embedding-envelope';
import { createEmbeddingPresignTokenRoute } from './create-embedding-presign-token';
import { createEmbeddingTemplateRoute } from './create-embedding-template';
import { getMultiSignDocumentRoute } from './get-multi-sign-document';
import { updateEmbeddingDocumentRoute } from './update-embedding-document';
import { updateEmbeddingEnvelopeRoute } from './update-embedding-envelope';
import { updateEmbeddingTemplateRoute } from './update-embedding-template';
import { verifyEmbeddingPresignTokenRoute } from './verify-embedding-presign-token';

export const embeddingPresignRouter = router({
  createEmbeddingPresignToken: createEmbeddingPresignTokenRoute,
  verifyEmbeddingPresignToken: verifyEmbeddingPresignTokenRoute,
  createEmbeddingEnvelope: createEmbeddingEnvelopeRoute,
  createEmbeddingDocument: createEmbeddingDocumentRoute,
  createEmbeddingTemplate: createEmbeddingTemplateRoute,
  updateEmbeddingEnvelope: updateEmbeddingEnvelopeRoute,
  updateEmbeddingDocument: updateEmbeddingDocumentRoute,
  updateEmbeddingTemplate: updateEmbeddingTemplateRoute,
  // applyMultiSignSignature: applyMultiSignSignatureRoute,
  getMultiSignDocument: getMultiSignDocumentRoute,
});
