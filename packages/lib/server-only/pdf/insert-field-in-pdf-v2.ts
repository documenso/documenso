import type { PDFDocument } from '@cantoo/pdf-lib';
import { RotationTypes, radiansToDegrees } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import Konva from 'konva';
import 'konva/skia-backend';
import type { Canvas } from 'skia-canvas';
import { match } from 'ts-pattern';

import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderField } from '../../universal/field-renderer/render-field';
import { getPageSize } from './get-page-size';

// const font = await pdf.embedFont(
//   isSignatureField ? fontCaveat : fontNoto,
//   isSignatureField ? { features: { calt: false } } : undefined,
// );
// const minFontSize = isSignatureField ? MIN_HANDWRITING_FONT_SIZE : MIN_STANDARD_FONT_SIZE;
// const maxFontSize = isSignatureField ? DEFAULT_HANDWRITING_FONT_SIZE : DEFAULT_STANDARD_FONT_SIZE;

export const insertFieldInPDFV2 = async (pdf: PDFDocument, field: FieldWithSignature) => {
  const [fontCaveat, fontNoto] = await Promise.all([
    fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`).then(async (res) => res.arrayBuffer()),
    fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(async (res) => res.arrayBuffer()),
  ]);

  const isSignatureField = isSignatureFieldType(field.type);

  pdf.registerFontkit(fontkit);

  const pages = pdf.getPages();

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

  // Todo: Evenloeps - getPageSize this had extra logic? Ask lucas

  console.log({
    cropBox: page.getCropBox(),
    mediaBox: page.getMediaBox(),
    mediaBox2: page.getSize(),
  });

  const { width: pageWidth, height: pageHeight } = getPageSize(page);

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
    // [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  console.log({
    pageWidth,
    pageHeight,
    fieldWidth: field.width,
    fieldHeight: field.height,
  });

  const stage = new Konva.Stage({ width: pageWidth, height: pageHeight });
  const layer = new Konva.Layer();

  // Will render onto the layer.
  renderField({
    scale: 1,
    field: {
      renderId: field.id.toString(),
      ...field,
      width: Number(field.width),
      height: Number(field.height),
      positionX: Number(field.positionX),
      positionY: Number(field.positionY),
    },
    pageLayer: layer,
    pageWidth,
    pageHeight,
    mode: 'export',
  });

  stage.add(layer);
  const canvas = layer.canvas._canvas as unknown as Canvas;

  const renderedField = await canvas.toBuffer('svg');

  // fs.writeFileSync(
  //   `rendered-field-${field.envelopeId}--${field.id}.svg`,
  //   renderedField.toString('utf-8'),
  // );

  // Embed the SVG into the PDF
  const svgElement = await pdf.embedSvg(renderedField.toString('utf-8'));

  // Calculate position to cover the whole page
  // pdf-lib coordinates: (0,0) is bottom-left, y increases upward
  const svgWidth = pageWidth; // Use full page width
  const svgHeight = pageHeight; // Use full page height

  const x = 0; // Start from left edge
  const y = pageHeight; // Start from bottom edge

  // Draw the SVG on the page
  page.drawSvg(svgElement, {
    x: x,
    y: y,
    width: svgWidth,
    height: svgHeight,
  });

  return pdf;
};
