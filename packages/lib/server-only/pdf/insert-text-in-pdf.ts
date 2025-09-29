import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { CAVEAT_FONT_PATH, NOTO_SANS_FONT_PATH, NOTO_SANS_THAI_FONT_PATH } from '../../constants/pdf';
import { getFontTypeForText } from '../../utils/font-detection';

export async function insertTextInPDF(
  pdfAsBase64: string,
  text: string,
  positionX: number,
  positionY: number,
  page = 0,
  useHandwritingFont = true,
  customFontSize?: number,
): Promise<string> {
  // Determine the appropriate font based on text content
  const fontType = getFontTypeForText(text, useHandwritingFont);

  let fontBuffer: ArrayBuffer | undefined;

  // Fetch the appropriate font based on content
  if (fontType === 'handwriting') {
    const fontResponse = await fetch(CAVEAT_FONT_PATH());
    fontBuffer = await fontResponse.arrayBuffer();
  } else if (fontType === 'thai') {
    const fontResponse = await fetch(NOTO_SANS_THAI_FONT_PATH());
    fontBuffer = await fontResponse.arrayBuffer();
  } else if (fontType === 'standard') {
    const fontResponse = await fetch(NOTO_SANS_FONT_PATH());
    fontBuffer = await fontResponse.arrayBuffer();
  }

  const pdfDoc = await PDFDocument.load(pdfAsBase64);

  pdfDoc.registerFontkit(fontkit);

  const font = await pdfDoc.embedFont(
    fontBuffer || StandardFonts.Helvetica,
    fontType === 'handwriting' ? { features: { calt: false } } : undefined
  );

  const pages = pdfDoc.getPages();
  const pdfPage = pages[page];

  const textSize = customFontSize || (useHandwritingFont ? 50 : 15);
  const textWidth = font.widthOfTextAtSize(text, textSize);
  const textHeight = font.heightAtSize(textSize);
  const fieldSize = { width: 250, height: 64 };

  // Because pdf-lib use a bottom-left coordinate system, we need to invert the y position
  // we then center the text in the middle by adding half the height of the text
  // plus the height of the field and divide the result by 2
  const invertedYPosition =
    pdfPage.getHeight() - positionY - (fieldSize.height + textHeight / 2) / 2;

  // We center the text by adding the width of the field, subtracting the width of the text
  // and dividing the result by 2
  const centeredXPosition = positionX + (fieldSize.width - textWidth) / 2;

  pdfPage.drawText(text, {
    x: centeredXPosition,
    y: invertedYPosition,
    size: textSize,
    color: rgb(0, 0, 0),
    font,
  });

  const pdfAsUint8Array = await pdfDoc.save();

  return Buffer.from(pdfAsUint8Array).toString('base64');
}
