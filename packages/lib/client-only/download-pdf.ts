import { PDFDocument } from 'pdf-lib';

import { flattenAnnotations } from '@documenso/lib/server-only/pdf/flatten-annotations';
import { flattenForm } from '@documenso/lib/server-only/pdf/flatten-form';
import { normalizeSignatureAppearances } from '@documenso/lib/server-only/pdf/normalize-signature-appearances';
import type { DocumentData } from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import { getFile } from '../universal/upload/get-file';
import { downloadFile } from './download-file';

type DownloadPDFProps = {
  documentData: DocumentData;
  fileName?: string;
  withCertificate?: boolean;
};

export const downloadPDF = async ({
  documentData,
  fileName,
  withCertificate,
}: DownloadPDFProps) => {
  const pdfData = await getFile(documentData);
  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');

  if (withCertificate) {
    const blob = new Blob([pdfData], {
      type: 'application/pdf',
    });

    downloadFile({
      filename: `${baseTitle}_signed.pdf`,
      data: blob,
    });
  } else {
    const pdfDoc = await PDFDocument.load(pdfData);
    const newPdf = await PDFDocument.create();

    const pages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices().slice(0, -1));
    pages.forEach((page) => newPdf.addPage(page));

    normalizeSignatureAppearances(newPdf);
    flattenForm(newPdf);
    flattenAnnotations(newPdf);

    const pdfWithoutSigningCertificate = await newPdf.save();
    const signedPdfBuffers = await signPdf({ pdf: Buffer.from(pdfWithoutSigningCertificate) });

    const blob = new Blob([signedPdfBuffers], {
      type: 'application/pdf',
    });

    downloadFile({
      filename: `${baseTitle}_signed.pdf`,
      data: blob,
    });
  }
};
