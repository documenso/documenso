// https://github.com/Hopding/pdf-lib/issues/20#issuecomment-412852821
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, RotationTypes, degrees, radiansToDegrees } from 'pdf-lib';
import { match } from 'ts-pattern';

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

  const fontNoto = await fetch(process.env.FONT_NOTO_SANS_URI).then(async (res) =>
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

  const pageRotation = page.getRotation();

  let pageRotationInDegrees = match(pageRotation.type)
    .with(RotationTypes.Degrees, () => pageRotation.angle)
    .with(RotationTypes.Radians, () => radiansToDegrees(pageRotation.angle))
    .exhaustive();

  // Round to the closest multiple of 90 degrees.
  pageRotationInDegrees = Math.round(pageRotationInDegrees / 90) * 90;

  const isPageRotatedToLandscape = pageRotationInDegrees === 90 || pageRotationInDegrees === 270;

  let { width: pageWidth, height: pageHeight } = page.getSize();

  // PDFs can have pages that are rotated, which are correctly rendered in the frontend.
  // However when we load the PDF in the backend, the rotation is applied.
  //
  // To account for this, we swap the width and height for pages that are rotated by 90/270
  // degrees. This is so we can calculate the virtual position the field was placed if it
  // was correctly oriented in the frontend.
  //
  // Then when we insert the fields, we apply a transformation to the position of the field
  // so it is rotated correctly.
  if (isPageRotatedToLandscape) {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  const fieldWidth = pageWidth * (Number(field.width) / 100);
  const fieldHeight = pageHeight * (Number(field.height) / 100);

  const fieldX = pageWidth * (Number(field.positionX) / 100);
  const fieldY = pageHeight * (Number(field.positionY) / 100);

  const font = await pdf.embedFont(isSignatureField ? fontCaveat : fontNoto);

  if (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE) {
    await pdf.embedFont(fontCaveat);
  }

  const isInsertingImage =
    isSignatureField && typeof field.Signature?.signatureImageAsBase64 === 'string';

  if (isSignatureField && isInsertingImage) {
    const image = await pdf.embedPng(field.Signature?.signatureImageAsBase64 ?? '');

    let imageWidth = image.width;
    let imageHeight = image.height;

    const scalingFactor = Math.min(fieldWidth / imageWidth, fieldHeight / imageHeight, 1);

    imageWidth = imageWidth * scalingFactor;
    imageHeight = imageHeight * scalingFactor;

    let imageX = fieldX + (fieldWidth - imageWidth) / 2;
    let imageY = fieldY + (fieldHeight - imageHeight) / 2;

    // Invert the Y axis since PDFs use a bottom-left coordinate system
    imageY = pageHeight - imageY - imageHeight;

    if (pageRotationInDegrees !== 0) {
      const adjustedPosition = adjustPositionForRotation(
        pageWidth,
        pageHeight,
        imageX,
        imageY,
        pageRotationInDegrees,
      );

      imageX = adjustedPosition.xPos;
      imageY = adjustedPosition.yPos;
    }

    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
      rotate: degrees(pageRotationInDegrees),
    });
  } else {
    const longestLineInTextForWidth = field.customText
      .split('\n')
      .sort((a, b) => b.length - a.length)[0];

    let textWidth = font.widthOfTextAtSize(longestLineInTextForWidth, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    const scalingFactor = Math.min(fieldWidth / textWidth, fieldHeight / textHeight, 1);

    fontSize = Math.max(Math.min(fontSize * scalingFactor, maxFontSize), minFontSize);
    textWidth = font.widthOfTextAtSize(longestLineInTextForWidth, fontSize);

    let textX = fieldX + (fieldWidth - textWidth) / 2;
    let textY = fieldY + (fieldHeight - textHeight) / 2;

    // Invert the Y axis since PDFs use a bottom-left coordinate system
    textY = pageHeight - textY - textHeight;

    if (pageRotationInDegrees !== 0) {
      const adjustedPosition = adjustPositionForRotation(
        pageWidth,
        pageHeight,
        textX,
        textY,
        pageRotationInDegrees,
      );

      textX = adjustedPosition.xPos;
      textY = adjustedPosition.yPos;
    }

    page.drawText(field.customText, {
      x: textX,
      y: textY,
      size: fontSize,
      font,
      rotate: degrees(pageRotationInDegrees),
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

const adjustPositionForRotation = (
  pageWidth: number,
  pageHeight: number,
  xPos: number,
  yPos: number,
  pageRotationInDegrees: number,
) => {
  if (pageRotationInDegrees === 270) {
    xPos = pageWidth - xPos;
    [xPos, yPos] = [yPos, xPos];
  }

  if (pageRotationInDegrees === 90) {
    yPos = pageHeight - yPos;
    [xPos, yPos] = [yPos, xPos];
  }

  // Invert all the positions since it's rotated by 180 degrees.
  if (pageRotationInDegrees === 180) {
    xPos = pageWidth - xPos;
    yPos = pageHeight - yPos;
  }

  return {
    xPos,
    yPos,
  };
};
