import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { parseDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

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
    const { envelopeId, page = 1, perPage = 50, orderByColumn, orderByDirection } = input;

    ctx.logger.info({ input: { envelopeId } });

    const isLegacyDocumentId = /^\d+$/.test(envelopeId);
    const idConfig = isLegacyDocumentId
      ? { type: 'documentId' as const, id: Number(envelopeId) }
      : { type: 'envelopeId' as const, id: envelopeId };

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: idConfig,
      type: isLegacyDocumentId ? EnvelopeType.DOCUMENT : null,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const normalizedPage = Math.max(page, 1);
    const skip = (normalizedPage - 1) * perPage;

    const [data, count] = await Promise.all([
      prisma.documentAuditLog.findMany({
        where: { envelopeId: envelope.id },
        skip,
        take: perPage,
        orderBy: { [orderByColumn ?? 'createdAt']: orderByDirection ?? 'desc' },
      }),
      prisma.documentAuditLog.count({
        where: { envelopeId: envelope.id },
      }),
    ]);

    const parsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

    return {
      data: parsedData,
      count,
      currentPage: normalizedPage,
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof parsedData>;
  });
