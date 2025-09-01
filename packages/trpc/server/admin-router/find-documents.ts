import { findDocuments } from '@documenso/lib/server-only/admin/get-all-documents';

import { adminProcedure } from '../trpc';
import { ZFindDocumentsRequestSchema, ZFindDocumentsResponseSchema } from './find-documents.types';

export const findDocumentsRoute = adminProcedure
  .input(ZFindDocumentsRequestSchema)
  .output(ZFindDocumentsResponseSchema)
  .query(async ({ input }) => {
    const { query, page, perPage } = input;

    return await findDocuments({ query, page, perPage });
  });
