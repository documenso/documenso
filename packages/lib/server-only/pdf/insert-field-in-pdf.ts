import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import { FieldType } from '@documenso/prisma/client';
import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

const DEFAULT_STANDARD_FONT_SIZE = 15;
const DEFAULT_HANDWRITING_FONT_SIZE = 50;

export const insertFieldInPDF = async (pdf: PDFDocument, field: FieldWithSignature) => {
  const isSignatureField = isSignatureFieldType(field.type);

  pdf.registerFontkit(fontkit);

  const fontCaveat = readFileSync('./public/fonts/caveat.ttf');

  const pages = pdf.getPages();

  const maxFontSize = isSignatureField ? DEFAULT_HANDWRITING_FONT_SIZE : DEFAULT_STANDARD_FONT_SIZE;
  let fontSize = isSignatureField ? DEFAULT_HANDWRITING_FONT_SIZE : DEFAULT_STANDARD_FONT_SIZE;

  const page = pages.at(field.page - 1);

  if (!page) {
    throw new Error(`Page ${field.page} does not exist`);
  }

  const { width: pageWidth, height: pageHeight } = page.getSize();

  const fieldWidth = pageWidth * (Number(field.width) / 100);
  const fieldHeight = pageHeight * (Number(field.height) / 100);

  const fieldX = pageWidth * (Number(field.positionX) / 100);
  const fieldY = pageHeight * (Number(field.positionY) / 100);

  const font = await pdf.embedFont(isSignatureField ? fontCaveat : StandardFonts.Helvetica);

  if (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE) {
    await pdf.embedFont(fontCaveat);
  }

  const isInsertingImage =
    isSignatureField && typeof field.Signature?.signatureImageAsBase64 === 'string';

  if (isSignatureField && isInsertingImage) {
    const image = await pdf.embedPng(field.Signature?.signatureImageAsBase64 ?? '');

    let imageWidth = image.width;
    let imageHeight = image.height;

    // const initialDimensions = {
    //   width: imageWidth,
    //   height: imageHeight,
    // };

    const scalingFactor = Math.min(fieldWidth / imageWidth, fieldHeight / imageHeight, 1);

    imageWidth = imageWidth * scalingFactor;
    imageHeight = imageHeight * scalingFactor;

    const imageX = fieldX + (fieldWidth - imageWidth) / 2;
    let imageY = fieldY + (fieldHeight - imageHeight) / 2;

    // Invert the Y axis since PDFs use a bottom-left coordinate system
    imageY = pageHeight - imageY - imageHeight;

    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    });
  } else {
    let textWidth = font.widthOfTextAtSize(field.customText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // const initialDimensions = {
    //   width: textWidth,
    //   height: textHeight,
    // };

    const scalingFactor = Math.min(fieldWidth / textWidth, fieldHeight / textHeight, 1);

    fontSize = Math.max(fontSize * scalingFactor, maxFontSize);
    textWidth = font.widthOfTextAtSize(field.customText, fontSize);

    const textX = fieldX + (fieldWidth - textWidth) / 2;
    let textY = fieldY + (fieldHeight - textHeight) / 2;

    // Invert the Y axis since PDFs use a bottom-left coordinate system
    textY = pageHeight - textY - textHeight;

    page.drawText(field.customText, {
      x: textX,
      y: textY,
      size: fontSize,
      font,
    });
  }

  return pdf;
};

export const insertFieldInPDFBytes = async (
  pdf: ArrayBuffer | Uint8Array | string,
  field: FieldWithSignature,
) => {
  const pdfDoc = await PDFDocument.load(pdf);

  await insertFieldInPDF(pdfDoc, field);

  return await pdfDoc.save();
};
