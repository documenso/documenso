import type { FindResultSet } from '@documenso/lib/types/find-result-set';
import { prisma } from '@documenso/prisma';
import type { UserSecurityAuditLog, UserSecurityAuditLogType } from '@documenso/prisma/client';

export type FindUserSecurityAuditLogsOptions = {
  userId: number;
  type?: UserSecurityAuditLogType;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<UserSecurityAuditLog, 'id' | 'userId'>;
    direction: 'asc' | 'desc';
  };
};

export const findUserSecurityAuditLogs = async ({
  userId,
  type,
  page = 1,
  perPage = 10,
  orderBy,
}: FindUserSecurityAuditLogsOptions) => {
  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause = {
    userId,
    type,
  };

  const [data, count] = await Promise.all([
    prisma.userSecurityAuditLog.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
    }),
    prisma.userSecurityAuditLog.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultSet<typeof data>;
};
