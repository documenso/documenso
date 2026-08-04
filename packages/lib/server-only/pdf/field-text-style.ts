import type { PDFFont, PDFPage, Rotation } from '@cantoo/pdf-lib';
import { degrees } from '@cantoo/pdf-lib';

type PdfTextStyleMeta = {
  fontWeight?: 'normal' | 'bold' | null;
  fontStyle?: 'normal' | 'italic' | null;
};

type StyledTextDrawOptions = {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  rotate: Rotation;
  fieldMeta?: PdfTextStyleMeta | null;
};

export const hasPdfTextStyle = (fieldMeta: PdfTextStyleMeta | null | undefined) => {
  return fieldMeta?.fontWeight === 'bold' || fieldMeta?.fontStyle === 'italic';
};

export const getPdfTextStyleDrawingOptions = (fieldMeta: PdfTextStyleMeta | null | undefined) => {
  return {
    offsets:
      fieldMeta?.fontWeight === 'bold'
        ? [
            { x: 0, y: 0 },
            { x: 0.35, y: 0 },
            { x: 0, y: 0.35 },
          ]
        : [{ x: 0, y: 0 }],
    xSkewDegrees: fieldMeta?.fontStyle === 'italic' ? 12 : 0,
  };
};

export const drawStyledFieldText = ({ page, text, x, y, size, font, rotate, fieldMeta }: StyledTextDrawOptions) => {
  const { offsets, xSkewDegrees } = getPdfTextStyleDrawingOptions(fieldMeta);

  for (const offset of offsets) {
    page.drawText(text, {
      x: x + offset.x,
      y: y + offset.y,
      size,
      font,
      rotate,
      xSkew: degrees(xSkewDegrees),
    });
  }
};
