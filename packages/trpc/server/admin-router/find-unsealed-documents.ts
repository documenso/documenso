import { adminFindUnsealedDocuments } from '@documenso/lib/server-only/admin/admin-find-unsealed-documents';

import { adminProcedure } from '../trpc';
import {
  ZFindUnsealedDocumentsRequestSchema,
  ZFindUnsealedDocumentsResponseSchema,
} from './find-unsealed-documents.types';

export const findUnsealedDocumentsRoute = adminProcedure
  .input(ZFindUnsealedDocumentsRequestSchema)
  .output(ZFindUnsealedDocumentsResponseSchema)
  .query(async ({ input }) => {
    const { page, perPage } = input;

    return await adminFindUnsealedDocuments({ page, perPage });
  });
