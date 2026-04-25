import { PDF, rgb } from '@libpdf/core';
import { groupBy } from 'remeda';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';
import { insertFieldInPDFV2 } from './insert-field-in-pdf-v2';

type GeneratePartialSignedPdfOptions = {
  pdfData: Uint8Array;
  fields: FieldWithSignature[];
  envelopeId: string;
  pendingRecipientCount: number;
  generatedAt: Date;
};

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

export const generatePartialSignedPdf = async ({
  pdfData,
  fields,
  envelopeId,
  pendingRecipientCount,
  generatedAt,
}: GeneratePartialSignedPdfOptions) => {
  const signatureText =
    pendingRecipientCount === 1 ? '1 more signature' : `${pendingRecipientCount} more signatures`;
  const bannerText = `DRAFT — Not a final executed document. Awaiting ${signatureText}. Envelope ${envelopeId} · ${generatedAt.toISOString()}`;

  const pdfDoc = await PDF.load(pdfData);

  pdfDoc.flattenAll();
  pdfDoc.upgradeVersion('1.7');

  const fieldsGroupedByPage = groupBy(fields, (field) => field.page);

  for (const [pageNumber, pageFields] of Object.entries(fieldsGroupedByPage)) {
    const page = pdfDoc.getPage(Number(pageNumber) - 1);

    if (!page) {
      throw new Error(`Page ${pageNumber} does not exist`);
    }

    const pageWidth = page.width;
    const pageHeight = page.height;
    const overlayBytes = await insertFieldInPDFV2({
      pageWidth,
      pageHeight,
      fields: pageFields,
    });

    const overlayPdf = await PDF.load(overlayBytes);
    const embeddedPage = await pdfDoc.embedPage(overlayPdf, 0);

    let translateX = 0;
    let translateY = 0;

    switch (page.rotation) {
      case 90:
        translateX = pageHeight;
        translateY = 0;
        break;
      case 180:
        translateX = pageWidth;
        translateY = pageHeight;
        break;
      case 270:
        translateX = 0;
        translateY = pageWidth;
        break;
    }

    page.drawPage(embeddedPage, {
      x: translateX,
      y: translateY,
      rotate: {
        angle: page.rotation,
      },
    });
  }

  fontBytesPromise ??= fetch(`${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(
    async (res) => res.arrayBuffer(),
  );

  const fontBytes = await fontBytesPromise;
  const font = pdfDoc.embedFont(new Uint8Array(fontBytes));

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  if (firstPage) {
    firstPage.drawText(bannerText, {
      x: firstPage.width * 0.05,
      y: firstPage.height * 0.45,
      size: 28,
      font,
      color: rgb(185 / 255, 28 / 255, 28 / 255),
      opacity: 0.16,
      maxWidth: firstPage.width * 1.35,
      rotate: {
        angle: 45,
        origin: 'center',
      },
    });
  }

  for (const page of pages) {
    page.drawText(bannerText, {
      x: 24,
      y: 14,
      size: 8,
      font,
      color: rgb(75 / 255, 85 / 255, 99 / 255),
      opacity: 0.85,
      maxWidth: Math.max(page.width - 48, 1),
    });
  }

  pdfDoc.flattenAll();

  return await pdfDoc.save({ useXRefStream: true });
};
