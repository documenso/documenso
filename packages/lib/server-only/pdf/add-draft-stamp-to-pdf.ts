import { type PDF, rgb } from '@libpdf/core';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';

const STAMP_COLOR = rgb(217 / 255, 119 / 255, 6 / 255);

/**
 * Adds a "draft / not fully executed" watermark to each page of a PDF document.
 *
 * Used for partial downloads of documents that have not yet been fully signed,
 * so the resulting PDF cannot be mistaken for a completed/sealed document.
 */
export async function addDraftStampToPdf(pdf: PDF): Promise<PDF> {
  const pages = pdf.getPages();

  const fontBytes = await fetch(`${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(
    async (res) => res.arrayBuffer(),
  );

  const font = pdf.embedFont(new Uint8Array(fontBytes));

  const titleText = 'DRAFT — NOT FULLY EXECUTED';
  const subtitleText = 'Partial download. Awaiting one or more signatures.';
  const titleFontSize = 28;
  const subtitleFontSize = 11;
  const rotationAngle = 30;

  for (const page of pages) {
    const { width, height } = page;
    const centerX = width / 2;
    const centerY = height / 2;

    const widthOfTitle = font.getTextWidth(titleText, titleFontSize);
    const padding = 20;
    const rectWidth = widthOfTitle + padding;
    const rectHeight = titleFontSize + padding;

    const rectX = centerX - rectWidth / 2;
    const rectY = centerY - rectHeight / 4;

    page.drawRectangle({
      x: rectX,
      y: rectY,
      width: rectWidth,
      height: rectHeight,
      borderColor: STAMP_COLOR,
      borderWidth: 3,
      rotate: {
        angle: rotationAngle,
        origin: 'center',
      },
    });

    page.drawText(titleText, {
      x: centerX - widthOfTitle / 2,
      y: centerY,
      size: titleFontSize,
      font,
      color: STAMP_COLOR,
      rotate: {
        angle: rotationAngle,
        origin: 'center',
      },
    });

    const widthOfSubtitle = font.getTextWidth(subtitleText, subtitleFontSize);

    page.drawText(subtitleText, {
      x: centerX - widthOfSubtitle / 2,
      y: centerY - titleFontSize,
      size: subtitleFontSize,
      font,
      color: STAMP_COLOR,
      rotate: {
        angle: rotationAngle,
        origin: 'center',
      },
    });

    const footerText = 'DRAFT — NOT FULLY EXECUTED';
    const footerFontSize = 8;
    const footerWidth = font.getTextWidth(footerText, footerFontSize);

    page.drawText(footerText, {
      x: width - footerWidth - 16,
      y: 12,
      size: footerFontSize,
      font,
      color: STAMP_COLOR,
    });
  }

  return pdf;
}
