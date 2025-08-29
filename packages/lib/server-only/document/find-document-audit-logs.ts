import type { DocumentAuditLog, Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { FindResultResponse } from '../../types/search-params';
import { parseDocumentAuditLogData } from '../../utils/document-audit-logs';
import { getDocumentWhereInput } from './get-document-by-id';

export interface FindDocumentAuditLogsOptions {
  userId: number;
  teamId: number;
  documentId: number;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof DocumentAuditLog;
    direction: 'asc' | 'desc';
  };
  cursor?: string;
  filterForRecentActivity?: boolean;
}

export const findDocumentAuditLogs = async ({
  userId,
  teamId,
  documentId,
  page = 1,
  perPage = 30,
  orderBy,
  cursor,
  filterForRecentActivity,
}: FindDocumentAuditLogsOptions) => {
  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.DocumentAuditLogWhereInput = {
    documentId,
  };

  // Filter events down to what we consider recent activity.
  if (filterForRecentActivity) {
    whereClause.OR = [
      {
        type: {
          in: [
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
            DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM,
          ],
        },
      },
      {
        type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
        data: {
          path: ['isResending'],
          equals: true,
        },
      },
    ];
  }

  const [data, count] = await Promise.all([
    prisma.documentAuditLog.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage + 1,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      cursor: cursor ? { id: cursor } : undefined,
    }),
    prisma.documentAuditLog.count({
      where: whereClause,
    }),
  ]);

  let nextCursor: string | undefined = undefined;

  const parsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

  if (parsedData.length > perPage) {
    const nextItem = parsedData.pop();
    nextCursor = nextItem!.id;
  }

  return {
    data: parsedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
    nextCursor,
  } satisfies FindResultResponse<typeof parsedData> & { nextCursor?: string };
};
