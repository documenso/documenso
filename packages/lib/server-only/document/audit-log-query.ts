import type { DocumentAuditLog, Envelope, Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { FindResultResponse } from '../../types/search-params';
import { parseDocumentAuditLogData } from '../../utils/document-audit-logs';

const RECENT_ACTIVITY_EVENT_TYPES = [
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
  DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM,
];

export interface AuditLogQueryOptions {
  envelope: Envelope;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof DocumentAuditLog;
    direction: 'asc' | 'desc';
  };
  cursor?: string;
  filterForRecentActivity?: boolean;
}

function buildAuditLogWhereClause(
  envelope: Envelope,
  filterForRecentActivity?: boolean,
): Prisma.DocumentAuditLogWhereInput {
  const baseWhereClause: Prisma.DocumentAuditLogWhereInput = {
    envelopeId: envelope.id,
  };

  if (!filterForRecentActivity) {
    return baseWhereClause;
  }

  const recentActivityConditions: Prisma.DocumentAuditLogWhereInput['OR'] = [
    {
      type: {
        in: RECENT_ACTIVITY_EVENT_TYPES,
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

  return {
    ...baseWhereClause,
    OR: recentActivityConditions,
  };
}

export async function queryAuditLogs({
  envelope,
  page = 1,
  perPage = 30,
  orderBy,
  cursor,
  filterForRecentActivity,
}: AuditLogQueryOptions) {
  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause = buildAuditLogWhereClause(envelope, filterForRecentActivity);

  const normalizedPage = Math.max(page, 1);
  const skip = (normalizedPage - 1) * perPage;

  const [data, count] = await Promise.all([
    prisma.documentAuditLog.findMany({
      where: whereClause,
      skip,
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

  const allParsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

  const hasNextPage = allParsedData.length > perPage;
  const parsedData = hasNextPage ? allParsedData.slice(0, perPage) : allParsedData;
  const nextCursor = hasNextPage ? allParsedData[perPage].id : undefined;

  return {
    data: parsedData,
    count,
    currentPage: normalizedPage,
    perPage,
    totalPages: Math.ceil(count / perPage),
    nextCursor,
  } satisfies FindResultResponse<typeof parsedData> & { nextCursor?: string };
}
