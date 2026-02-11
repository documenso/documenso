import { PDF } from '@libpdf/core';
import { EnvelopeType } from '@prisma/client';

import { PDF_SIZE_A4_72PPI } from '@documenso/lib/constants/pdf';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { generateAuditLogPdf } from '@documenso/lib/server-only/pdf/generate-audit-log-pdf';
import { getLastPageDimensions } from '@documenso/lib/server-only/pdf/get-page-size';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';

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

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: ctx.user.id,
      teamId,
    }).catch(() => null);

    if (!envelope) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this document.',
      });
    }

    let pageWidth = PDF_SIZE_A4_72PPI.width;
    let pageHeight = PDF_SIZE_A4_72PPI.height;

    const firstItem = envelope.envelopeItems[0];

    if (firstItem) {
      const pdfData = await getFileServerSide(firstItem.documentData);
      const pdfDoc = await PDF.load(pdfData);
      const dims = getLastPageDimensions(pdfDoc);

      pageWidth = dims.width;
      pageHeight = dims.height;
    }

    const auditLogPdf = await generateAuditLogPdf({
      envelope,
      recipients: envelope.recipients,
      fields: envelope.fields,
      language: envelope.documentMeta.language,
      envelopeOwner: {
        email: envelope.user.email,
        name: envelope.user.name || '',
      },
      envelopeItems: envelope.envelopeItems.map((item) => item.title),
      pageWidth,
      pageHeight,
    });

    const result = await auditLogPdf.save();

    const base64 = Buffer.from(result).toString('base64');

    return {
      data: base64,
      envelopeTitle: envelope.title,
    };
  });
