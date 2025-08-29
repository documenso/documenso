import { searchDocumentsWithKeyword } from '@documenso/lib/server-only/document/search-documents-with-keyword';

import { authenticatedProcedure } from '../trpc';
import {
  ZSearchDocumentRequestSchema,
  ZSearchDocumentResponseSchema,
} from './search-document.types';

export const searchDocumentRoute = authenticatedProcedure
  .input(ZSearchDocumentRequestSchema)
  .output(ZSearchDocumentResponseSchema)
  .query(async ({ input, ctx }) => {
    const { query } = input;

    const documents = await searchDocumentsWithKeyword({
      query,
      userId: ctx.user.id,
    });

    return documents;
  });
