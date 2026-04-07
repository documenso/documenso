// sort-imports-ignore
import '../konva/skia-backend';

import Konva from 'konva';
import type { Canvas } from 'skia-canvas';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { renderField } from '../../universal/field-renderer/render-field';
import { ensureFontLibrary } from './helpers';

type InsertFieldInPDFV2Options = {
  pageWidth: number;
  pageHeight: number;
  fields: FieldWithSignature[];
};

export const insertFieldInPDFV2 = async ({
  pageWidth,
  pageHeight,
  fields,
}: InsertFieldInPDFV2Options) => {
  ensureFontLibrary();

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });
  let layer: Konva.Layer | null = new Konva.Layer();

  // Render the fields onto the layer.
  for (const field of fields) {
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
      translations: null,
      pageLayer: layer,
      pageWidth,
      pageHeight,
      mode: 'export',
    });
  }

  stage.add(layer);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const canvas = layer.canvas._canvas as unknown as Canvas;

  // Embed the SVG into the PDF
  const pdf = await canvas.toBuffer('pdf');

  stage.destroy();
  layer.destroy();

  stage = null;
  layer = null;

  return pdf;
};
