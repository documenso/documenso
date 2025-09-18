import { EnvelopeType } from '@prisma/client';
import { DateTime } from 'luxon';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

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

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: ctx.user.id,
      teamId,
    });

    if (!isDocumentCompleted(envelope.status)) {
      throw new AppError('DOCUMENT_NOT_COMPLETE');
    }

    const encrypted = encryptSecondaryData({
      data: mapSecondaryIdToDocumentId(envelope.secondaryId).toString(),
      expiresAt: DateTime.now().plus({ minutes: 5 }).toJSDate().valueOf(),
    });

    return {
      url: `${NEXT_PUBLIC_WEBAPP_URL()}/__htmltopdf/certificate?d=${encrypted}`,
    };
  });
