import { DateTime } from 'luxon';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';

import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadDocumentAuditLogsRequestSchema,
  ZDownloadDocumentAuditLogsResponseSchema,
} from './download-document-audit-logs.types';

export const downloadDocumentAuditLogsRoute = authenticatedProcedure
  .input(ZDownloadDocumentAuditLogsRequestSchema)
  .output(ZDownloadDocumentAuditLogsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    const document = await getDocumentById({
      documentId,
      userId: ctx.user.id,
      teamId,
    }).catch(() => null);

    if (!document || (teamId && document.teamId !== teamId)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this document.',
      });
    }

    const encrypted = encryptSecondaryData({
      data: document.id.toString(),
      expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
    });

    return {
      url: `${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/audit-log?d=${encrypted}`,
    };
  });
