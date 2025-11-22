import { findDocumentAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindDocumentAuditLogsRequestSchema,
  ZFindDocumentAuditLogsResponseSchema,
} from './find-document-audit-logs.types';

export const findDocumentAuditLogsRoute = authenticatedProcedure
  .input(ZFindDocumentAuditLogsRequestSchema)
  .output(ZFindDocumentAuditLogsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { orderByColumn, orderByDirection, ...auditLogParams } = input;

    ctx.logger.info({
      input: {
        documentId: input.documentId,
      },
    });

    return await findDocumentAuditLogs({
      ...auditLogParams,
      userId: ctx.user.id,
      teamId: ctx.teamId,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });
  });
