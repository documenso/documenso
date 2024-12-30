import { z } from 'zod';

import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';

import { authenticatedProcedure } from '../trpc';

export const ZFindUserSecurityAuditLogsRequestSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional(),
});

export const findUserSecurityAuditLogsRoute = authenticatedProcedure
  .input(ZFindUserSecurityAuditLogsRequestSchema)
  .query(async ({ input, ctx }) => {
    return await findUserSecurityAuditLogs({
      userId: ctx.user.id,
      ...input,
    });
  });
