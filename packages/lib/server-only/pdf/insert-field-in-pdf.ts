// https://github.com/Hopding/pdf-lib/issues/20#issuecomment-412852821
import fontkit from '@pdf-lib/fontkit';
import { FieldType } from '@prisma/client';
import type { PDFDocument } from 'pdf-lib';
import { RotationTypes, degrees, radiansToDegrees, rgb } from 'pdf-lib';
import { P, match } from 'ts-pattern';

import {
  DEFAULT_HANDWRITING_FONT_SIZE,
  DEFAULT_STANDARD_FONT_SIZE,
  MIN_HANDWRITING_FONT_SIZE,
  MIN_STANDARD_FONT_SIZE,
} from '@documenso/lib/constants/pdf';
import { fromCheckboxValue } from '@documenso/lib/universal/field-checkbox';
import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import {
  ZCheckboxFieldMeta,
  ZDateFieldMeta,
  ZEmailFieldMeta,
  ZInitialsFieldMeta,
  ZNameFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '../../types/field-meta';

export const insertFieldInPDF = async (pdf: PDFDocument, field: FieldWithSignature) => {
  const [fontCaveat, fontNoto] = await Promise.all([
    fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`).then(async (res) => res.arrayBuffer()),
    fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(async (res) => res.arrayBuffer()),
  ]);

  const isSignatureField = isSignatureFieldType(field.type);
  const isDebugMode =
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.DEBUG_PDF_INSERT === '1' || process.env.DEBUG_PDF_INSERT === 'true';

  pdf.registerFontkit(fontkit);

  const pages = pdf.getPages();

  const minFontSize = isSignatureField ? MIN_HANDWRITING_FONT_SIZE : MIN_STANDARD_FONT_SIZE;
  const maxFontSize = isSignatureField ? DEFAULT_HANDWRITING_FONT_SIZE : DEFAULT_STANDARD_FONT_SIZE;

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

  // Draw debug box if debug mode is enabled
  if (isDebugMode) {
    let debugX = fieldX;
    let debugY = pageHeight - fieldY - fieldHeight; // Invert Y for PDF coordinates

    if (pageRotationInDegrees !== 0) {
      const adjustedPosition = adjustPositionForRotation(
        pageWidth,
        pageHeight,
        debugX,
        debugY,
        pageRotationInDegrees,
      );

      debugX = adjustedPosition.xPos;
      debugY = adjustedPosition.yPos;
    }

    page.drawRectangle({
      x: debugX,
      y: debugY,
      width: fieldWidth,
      height: fieldHeight,
      borderColor: rgb(1, 0, 0), // Red
      borderWidth: 1,
      rotate: degrees(pageRotationInDegrees),
    });
  }

  const font = await pdf.embedFont(
    isSignatureField ? fontCaveat : fontNoto,
    isSignatureField ? { features: { calt: false } } : undefined,
  );

  if (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE) {
    await pdf.embedFont(fontCaveat);
  }

  await match(field)
    .with(
      {
        type: P.union(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE),
      },
      async (field) => {
        if (field.signature?.signatureImageAsBase64) {
          const image = await pdf.embedPng(field.signature?.signatureImageAsBase64 ?? '');

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
          const signatureText = field.signature?.typedSignature ?? '';

          const longestLineInTextForWidth = signatureText
            .split('\n')
            .sort((a, b) => b.length - a.length)[0];

          let fontSize = maxFontSize;
          let textWidth = font.widthOfTextAtSize(longestLineInTextForWidth, fontSize);
          let textHeight = font.heightAtSize(fontSize);

          const scalingFactor = Math.min(fieldWidth / textWidth, fieldHeight / textHeight, 1);
          fontSize = Math.max(Math.min(fontSize * scalingFactor, maxFontSize), minFontSize);

          textWidth = font.widthOfTextAtSize(longestLineInTextForWidth, fontSize);
          textHeight = font.heightAtSize(fontSize);

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

          page.drawText(signatureText, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            rotate: degrees(pageRotationInDegrees),
          });
        }
      },
    )
    .with({ type: FieldType.CHECKBOX }, (field) => {
      const meta = ZCheckboxFieldMeta.safeParse(field.fieldMeta);

      if (!meta.success) {
        console.error(meta.error);

        throw new Error('Invalid checkbox field meta');
      }

      const values = meta.data.values?.map((item) => ({
        ...item,
        value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
      }));

      const selected: string[] = fromCheckboxValue(field.customText);

      for (const [index, item] of (values ?? []).entries()) {
        const offsetY = index * 16;

        const checkbox = pdf.getForm().createCheckBox(`checkbox.${field.secondaryId}.${index}`);

        if (selected.includes(item.value)) {
          checkbox.check();
        }

        page.drawText(item.value.includes('empty-value-') ? '' : item.value, {
          x: fieldX + 16,
          y: pageHeight - (fieldY + offsetY),
          size: 12,
          font,
          rotate: degrees(pageRotationInDegrees),
        });

        checkbox.addToPage(page, {
          x: fieldX,
          y: pageHeight - (fieldY + offsetY),
          height: 8,
          width: 8,
        });
      }
    })
    .with({ type: FieldType.RADIO }, (field) => {
      const meta = ZRadioFieldMeta.safeParse(field.fieldMeta);

      if (!meta.success) {
        console.error(meta.error);

        throw new Error('Invalid radio field meta');
      }

      const values = meta?.data.values?.map((item) => ({
        ...item,
        value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
      }));

      const selected = field.customText.split(',');

      for (const [index, item] of (values ?? []).entries()) {
        const offsetY = index * 16;

        const radio = pdf.getForm().createRadioGroup(`radio.${field.secondaryId}.${index}`);

        page.drawText(item.value.includes('empty-value-') ? '' : item.value, {
          x: fieldX + 16,
          y: pageHeight - (fieldY + offsetY),
          size: 12,
          font,
          rotate: degrees(pageRotationInDegrees),
        });

        radio.addOptionToPage(item.value, page, {
          x: fieldX,
          y: pageHeight - (fieldY + offsetY),
          height: 8,
          width: 8,
        });

        if (selected.includes(item.value)) {
          radio.select(item.value);
        }
      }
    })
    .otherwise((field) => {
      const fieldMetaParsers = {
        [FieldType.TEXT]: ZTextFieldMeta,
        [FieldType.NUMBER]: ZNumberFieldMeta,
        [FieldType.DATE]: ZDateFieldMeta,
        [FieldType.EMAIL]: ZEmailFieldMeta,
        [FieldType.NAME]: ZNameFieldMeta,
        [FieldType.INITIALS]: ZInitialsFieldMeta,
      } as const;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const Parser = fieldMetaParsers[field.type as keyof typeof fieldMetaParsers];
      const meta = Parser ? Parser.safeParse(field.fieldMeta) : null;

      const customFontSize = meta?.success && meta.data.fontSize ? meta.data.fontSize : null;
      const textAlign = meta?.success && meta.data.textAlign ? meta.data.textAlign : 'center';
      const longestLineInTextForWidth = field.customText
        .split('\n')
        .sort((a, b) => b.length - a.length)[0];

      let fontSize = customFontSize || maxFontSize;
      let textWidth = font.widthOfTextAtSize(longestLineInTextForWidth, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      if (!customFontSize) {
        const scalingFactor = Math.min(fieldWidth / textWidth, fieldHeight / textHeight, 1);
        fontSize = Math.max(Math.min(fontSize * scalingFactor, maxFontSize), minFontSize);
      }

      textWidth = font.widthOfTextAtSize(longestLineInTextForWidth, fontSize);

      // Add padding similar to web display (roughly 0.5rem equivalent in PDF units)
      const padding = 8; // PDF points, roughly equivalent to 0.5rem

      // Calculate X position based on text alignment with padding
      let textX = fieldX + padding; // Left alignment starts after padding
      if (textAlign === 'center') {
        textX = fieldX + (fieldWidth - textWidth) / 2; // Center alignment ignores padding
      } else if (textAlign === 'right') {
        textX = fieldX + fieldWidth - textWidth - padding; // Right alignment respects right padding
      }

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
    });

  return pdf;
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
