import { DateTime } from 'luxon';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { isDocumentCompleted } from '@documenso/lib/utils/document';

import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadDocumentCertificateRequestSchema,
  ZDownloadDocumentCertificateResponseSchema,
} from './download-document-certificate.types';

export const downloadDocumentCertificateRoute = authenticatedProcedure
  .input(ZDownloadDocumentCertificateRequestSchema)
  .output(ZDownloadDocumentCertificateResponseSchema)
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
    });

    if (!isDocumentCompleted(document.status)) {
      throw new AppError('DOCUMENT_NOT_COMPLETE');
    }

    const encrypted = encryptSecondaryData({
      data: document.id.toString(),
      expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
    });

    return {
      url: `${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/certificate?d=${encrypted}`,
    };
  });
