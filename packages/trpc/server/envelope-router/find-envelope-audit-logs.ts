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
    const {
      envelopeId,
      page = 1,
      perPage = 50,
      orderByColumn = 'createdAt',
      orderByDirection = 'desc',
    } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    // Only documents have audit logs.
    if (envelope.type !== EnvelopeType.DOCUMENT) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Templates do not have audit logs.',
      });
    }

    const [data, count] = await Promise.all([
      prisma.documentAuditLog.findMany({
        where: { envelopeId: envelope.id },
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          [orderByColumn]: orderByDirection,
        },
      }),
      prisma.documentAuditLog.count({
        where: { envelopeId: envelope.id },
      }),
    ]);

    const parsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

    return {
      data: parsedData,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof parsedData>;
  });
