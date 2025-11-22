import { findEnvelopeAuditLogs } from '@documenso/lib/server-only/document/find-document-audit-logs';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindEnvelopeAuditLogsRequestSchema,
  ZFindEnvelopeAuditLogsResponseSchema,
  findEnvelopeAuditLogsMeta,
} from './find-envelope-audit-logs.types';

export const findEnvelopeAuditLogsRoute = authenticatedProcedure
  .meta(findEnvelopeAuditLogsMeta)
  .input(ZFindEnvelopeAuditLogsRequestSchema)
  .output(ZFindEnvelopeAuditLogsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { orderByColumn, orderByDirection, ...auditLogParams } = input;

    ctx.logger.info({
      input: {
        envelopeId: input.envelopeId,
      },
    });

    return await findEnvelopeAuditLogs({
      ...auditLogParams,
      userId: ctx.user.id,
      teamId: ctx.teamId,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });
  });
