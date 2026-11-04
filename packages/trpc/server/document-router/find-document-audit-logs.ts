import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZFindDocumentAuditLogsRequestSchema,
  ZFindDocumentAuditLogsResponseSchema,
} from './find-document-audit-logs.types';

export const findDocumentAuditLogsRoute = authenticatedProcedure
  .input(ZFindDocumentAuditLogsRequestSchema)
  .output(ZFindDocumentAuditLogsResponseSchema)
  .use(twoFactorScope((input) => ({ document: input.documentId })))
  .query(async ({ input, ctx }) => {
    const { teamId } = ctx;

    const { page, perPage, documentId, cursor, filterForRecentActivity, orderByColumn, orderByDirection } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    return await findDocumentAuditLogs({
      userId: ctx.user.id,
      teamId,
      page,
      perPage,
      documentId,
      cursor,
      filterForRecentActivity,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });
  });
