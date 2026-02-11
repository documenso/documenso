import { PDF } from '@libpdf/core';
import { EnvelopeType } from '@prisma/client';

import { PDF_SIZE_A4_72PPI } from '@documenso/lib/constants/pdf';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { generateCertificatePdf } from '@documenso/lib/server-only/pdf/generate-certificate-pdf';
import { getLastPageDimensions } from '@documenso/lib/server-only/pdf/get-page-size';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { prisma } from '@documenso/prisma';

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

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'documentId',
        id: documentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: ctx.user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      include: {
        recipients: true,
        fields: {
          include: {
            signature: true,
          },
        },
        envelopeItems: {
          include: {
            documentData: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        documentMeta: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    if (!isDocumentCompleted(envelope.status)) {
      throw new AppError('DOCUMENT_NOT_COMPLETE');
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

    const certificatePdf = await generateCertificatePdf({
      envelope,
      recipients: envelope.recipients,
      fields: envelope.fields,
      language: envelope.documentMeta.language,
      envelopeOwner: {
        email: envelope.user.email,
        name: envelope.user.name || '',
      },
      pageWidth,
      pageHeight,
    });

    const result = await certificatePdf.save();

    const base64 = Buffer.from(result).toString('base64');

    return {
      data: base64,
      envelopeTitle: envelope.title,
    };
  });
