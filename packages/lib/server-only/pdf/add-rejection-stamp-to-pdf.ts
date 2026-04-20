import { type PDF, rgb } from '@libpdf/core';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';

/**
 * Adds a rejection stamp to each page of a PDF document.
 * The stamp is placed in the center of the page.
 */
export async function addRejectionStampToPdf(pdf: PDF, reason: string): Promise<PDF> {
  const pages = pdf.getPages();

  const fontBytes = await fetch(`${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(
    async (res) => res.arrayBuffer(),
  );

  const font = pdf.embedFont(new Uint8Array(fontBytes));

  for (const page of pages) {
    const height = page.height;
    const width = page.width;

    // Draw the "REJECTED" text
    const rejectedTitleText = 'DOCUMENT REJECTED';
    const rejectedTitleFontSize = 36;
    const rotationAngle = 45;

    // Calculate the center position of the page
    const centerX = width / 2;
    const centerY = height / 2;

    const widthOfText = font.getTextWidth(rejectedTitleText, rejectedTitleFontSize);

    // Add padding for the rectangle
    const padding = 20;
    const rectWidth = widthOfText + padding;
    const rectHeight = rejectedTitleFontSize + padding;

    const rectX = centerX - rectWidth / 2;
    const rectY = centerY - rectHeight / 4;

    page.drawRectangle({
      x: rectX,
      y: rectY,
      width: rectWidth,
      height: rectHeight,
      borderColor: rgb(220 / 255, 38 / 255, 38 / 255),
      borderWidth: 4,
      rotate: {
        angle: rotationAngle,
        origin: 'center',
      },
    });

    const textX = centerX - widthOfText / 2;
    const textY = centerY;

    // Draw the text centered within the rectangle
    page.drawText(rejectedTitleText, {
      x: textX,
      y: textY,
      size: rejectedTitleFontSize,
      font,
      color: rgb(220 / 255, 38 / 255, 38 / 255),
      rotate: {
        angle: rotationAngle,
        origin: 'center',
      },
    });
  }

  return pdf;
}
