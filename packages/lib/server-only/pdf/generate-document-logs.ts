import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, grayscale, rgb } from 'pdf-lib';

import type { DocumentAuditLog } from '@documenso/prisma/client';
import type { DocumentFromDocumentById } from '@documenso/prisma/types/document';
import { signPdf } from '@documenso/signing';

import { putFile } from '../../universal/upload/put-file';

export type GenerateDocumentLogsOptions = {
  document: DocumentFromDocumentById;
  recipientsList: string[];
  auditLogs: DocumentAuditLog[];
  pageSize?: [number, number];
};

export const generateDocumentLogs = async ({
  document,
  recipientsList,
  auditLogs,
  pageSize = [595.28, 841.89], // A4 Page Size
}: GenerateDocumentLogsOptions) => {
  const documentInformation: { description: string; value: string }[] = [
    {
      description: 'Document title',
      value: document.title,
    },
    {
      description: 'Document ID',
      value: document.id.toString(),
    },
    {
      description: 'Document status',
      value: document.status,
    },
    {
      description: 'Created by',
      value: document.User.name ?? document.User.email,
    },
    {
      description: 'Date created',
      value: document.createdAt.toISOString(),
    },
    {
      description: 'Last updated',
      value: document.updatedAt.toISOString(),
    },
    {
      description: 'Time zone',
      value: document.documentMeta?.timezone ?? 'N/A',
    },
  ];

  const doc = await PDFDocument.create();

  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.addPage(pageSize);
  let currentY = pageSize[1] - 30;
  page.drawText(`${document.title} - Audit Logs`, {
    x: 30,
    y: currentY,
    size: 18,
    color: rgb(0, 0, 0),
    font: font,
  });
  currentY -= 30;

  page.drawText('Details', {
    x: 30,
    y: currentY,
    size: 16,
    color: rgb(0, 0, 0),
    font: font,
  });
  currentY -= 15;

  page.drawLine({
    start: { x: 30, y: currentY },
    end: { x: pageSize[0] - 60, y: currentY },
    thickness: 1,
    color: rgb(0.6, 0.9, 0.4),
    opacity: 0.8,
  });

  let leftColumn = true;
  currentY -= 20;
  documentInformation.forEach((docInfo) => {
    page.drawText(docInfo.description, {
      x: leftColumn ? 35 : pageSize[0] / 2,
      y: currentY,
      size: 12,
      color: rgb(0, 0, 0),
      font: font,
    });
    page.drawText(docInfo.value, {
      x: leftColumn ? 35 : pageSize[0] / 2,
      y: currentY - 16,
      size: 11,
      color: grayscale(0.5),
      font: font,
    });

    leftColumn = !leftColumn;
    currentY = leftColumn ? currentY - 36 : currentY;
  });
  page.drawText('Recipiets', {
    x: pageSize[0] / 2,
    y: currentY,
    size: 12,
    color: rgb(0, 0, 0),
    font: font,
  });
  currentY -= 18;
  recipientsList.forEach((recipient) => {
    page.drawText(`• ${recipient}`, {
      x: pageSize[0] / 2,
      y: currentY,
      size: 11,
      color: grayscale(0.5),
      font: font,
    });
    currentY -= 14;
  });

  page.drawLine({
    start: { x: 30, y: currentY },
    end: { x: pageSize[0] - 60, y: currentY },
    thickness: 1,
    color: rgb(0.6, 0.9, 0.4),
    opacity: 0.8,
  });

  const pdfBytes = await doc.save();
  const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

  return putFile({
    name: `${document.title}_logs.pdf`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBuffer),
  });
};
