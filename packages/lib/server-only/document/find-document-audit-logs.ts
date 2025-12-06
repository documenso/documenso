import type { DocumentAuditLog } from '@prisma/client';
import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { queryAuditLogs } from './audit-log-query';

interface BaseAuditLogOptions {
  userId: number;
  teamId: number;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof DocumentAuditLog;
    direction: 'asc' | 'desc';
  };
  cursor?: string;
  filterForRecentActivity?: boolean;
}

export interface FindDocumentAuditLogsOptions extends BaseAuditLogOptions {
  documentId: number;
}

export interface FindEnvelopeAuditLogsOptions extends BaseAuditLogOptions {
  envelopeId: string;
}

export const findDocumentAuditLogs = async ({
  userId,
  teamId,
  documentId,
  page,
  perPage,
  orderBy,
  cursor,
  filterForRecentActivity,
}: FindDocumentAuditLogsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return queryAuditLogs({
    envelope,
    page,
    perPage,
    orderBy,
    cursor,
    filterForRecentActivity,
  });
};

export const findEnvelopeAuditLogs = async ({
  userId,
  teamId,
  envelopeId,
  page,
  perPage,
  orderBy,
  cursor,
  filterForRecentActivity,
}: FindEnvelopeAuditLogsOptions) => {
  const isLegacyDocumentId = /^\d+$/.test(envelopeId);

  const idConfig = isLegacyDocumentId
    ? { type: 'documentId' as const, id: Number(envelopeId) }
    : { type: 'envelopeId' as const, id: envelopeId };

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: idConfig,
    type: isLegacyDocumentId ? EnvelopeType.DOCUMENT : null,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return queryAuditLogs({
    envelope,
    page,
    perPage,
    orderBy,
    cursor,
    filterForRecentActivity,
  });
};
