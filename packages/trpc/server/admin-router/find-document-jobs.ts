import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@doku-seal/lib/errors/app-error';
import type { FindResultResponse } from '@doku-seal/lib/types/search-params';
import {
  mapSecondaryIdToDocumentId,
  unsafeBuildEnvelopeIdQuery,
} from '@doku-seal/lib/utils/envelope';
import { prisma } from '@doku-seal/prisma';

import { adminProcedure } from '../trpc';
import {
  ZFindDocumentJobsRequestSchema,
  ZFindDocumentJobsResponseSchema,
} from './find-document-jobs.types';

export const findDocumentJobsRoute = adminProcedure
  .input(ZFindDocumentJobsRequestSchema)
  .output(ZFindDocumentJobsResponseSchema)
  .query(async ({ input }) => {
    const { envelopeId, page = 1, perPage = 5 } = input;

    const envelope = await prisma.envelope.findFirst({
      where: unsafeBuildEnvelopeIdQuery(
        {
          type: 'envelopeId',
          id: envelopeId,
        },
        EnvelopeType.DOCUMENT,
      ),
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    const [data, count] = await Promise.all([
      prisma.backgroundJob.findMany({
        where: {
          jobId: 'internal.seal-document',
          payload: {
            path: ['documentId'],
            equals: mapSecondaryIdToDocumentId(envelope.secondaryId),
          },
        },
        skip: Math.max(page - 1, 0) * perPage,
        take: perPage,
        orderBy: {
          submittedAt: 'desc',
        },
      }),
      prisma.backgroundJob.count({
        where: {
          jobId: 'internal.seal-document',
          payload: {
            path: ['documentId'],
            equals: mapSecondaryIdToDocumentId(envelope.secondaryId),
          },
        },
      }),
    ]);

    return {
      data,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof data>;
  });
