import { findDocuments } from '@documenso/lib/server-only/document/find-documents';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindDocumentsMeta,
  ZFindDocumentsRequestSchema,
  ZFindDocumentsResponseSchema,
} from './find-documents.types';

export const findDocumentsRoute = authenticatedProcedure
  .meta(ZFindDocumentsMeta)
  .input(ZFindDocumentsRequestSchema)
  .output(ZFindDocumentsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const {
      query,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      folderId,
    } = input;

    const documents = await findDocuments({
      userId: user.id,
      teamId,
      templateId,
      query,
      source,
      status,
      page,
      perPage,
      folderId,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });

    return documents;
  });
