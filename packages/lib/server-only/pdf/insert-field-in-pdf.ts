import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import {
  DEFAULT_HANDWRITING_FONT_SIZE,
  DEFAULT_STANDARD_FONT_SIZE,
  MIN_HANDWRITING_FONT_SIZE,
  MIN_STANDARD_FONT_SIZE,
} from '@documenso/lib/constants/pdf';
import { FieldType } from '@documenso/prisma/client';
import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

export const insertFieldInPDF = async (pdf: PDFDocument, field: FieldWithSignature) => {
  const fontCaveat = await fetch(process.env.FONT_CAVEAT_URI).then(async (res) =>
    res.arrayBuffer(),
  );

  const isSignatureField = isSignatureFieldType(field.type);

  pdf.registerFontkit(fontkit);

  const pages = pdf.getPages();

  const minFontSize = isSignatureField ? MIN_HANDWRITING_FONT_SIZE : MIN_STANDARD_FONT_SIZE;
  const maxFontSize = isSignatureField ? DEFAULT_HANDWRITING_FONT_SIZE : DEFAULT_STANDARD_FONT_SIZE;
  let fontSize = maxFontSize;

  const page = pages.at(field.page - 1);

  if (!page) {
    throw new Error(`Page ${field.page} does not exist`);
  }

  const { width: pageWidth, height: pageHeight } = page.getSize();

  const fieldWidth = pageWidth * (Number(field.width) / 100);
  const fieldHeight = pageHeight * (Number(field.height) / 100);

  const fieldX = pageWidth * (Number(field.positionX) / 100);
  const fieldY = pageHeight * (Number(field.positionY) / 100);

  // const url =
  //   'https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTQ.ttf';

  const url = 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SII.ttf';
  const googleFont = await fetch(url).then(async (res) => res.arrayBuffer());

  const font = await pdf.embedFont(isSignatureField ? googleFont : StandardFonts.Helvetica, {
    subset: true,
    features: { liga: false },
  });

  if (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE) {
    await pdf.embedFont(googleFont, { subset: true, features: { liga: false } });
  }

  const CUSTOM_TEXT = field.customText || field.Signature?.typedSignature || '';

  const isInsertingImage =
    isSignatureField &&
    typeof field.Signature?.signatureImageAsBase64 === 'string' &&
    field.Signature?.signatureImageAsBase64.startsWith('data:image/png;base64,');

  if (isSignatureField && isInsertingImage) {
    const image = await pdf.embedPng(field.Signature?.signatureImageAsBase64 ?? '');

    let imageWidth = image.width;
    let imageHeight = image.height;

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
    let textWidth = font.widthOfTextAtSize(CUSTOM_TEXT, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    const scalingFactor = Math.min(fieldWidth / textWidth, fieldHeight / textHeight, 1);

    fontSize = Math.max(Math.min(fontSize * scalingFactor, maxFontSize), minFontSize);
    textWidth = font.widthOfTextAtSize(CUSTOM_TEXT, fontSize);

    const textX = fieldX + (fieldWidth - textWidth) / 2;
    let textY = fieldY + (fieldHeight - textHeight) / 2;

    // Invert the Y axis since PDFs use a bottom-left coordinate system
    textY = pageHeight - textY - textHeight;

    page.drawText(CUSTOM_TEXT, {
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
