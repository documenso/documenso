import Konva from 'konva';
import 'konva/skia-backend';
import path from 'node:path';
import type { Canvas } from 'skia-canvas';
import { FontLibrary } from 'skia-canvas';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { renderField } from '../../universal/field-renderer/render-field';

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
  const fontPath = path.join(process.cwd(), 'public/fonts');

  FontLibrary.use([
    path.join(fontPath, 'caveat.ttf'),
    path.join(fontPath, 'noto-sans.ttf'),
    path.join(fontPath, 'noto-sans-japanese.ttf'),
    path.join(fontPath, 'noto-sans-chinese.ttf'),
    path.join(fontPath, 'noto-sans-korean.ttf'),
  ]);

  const stage = new Konva.Stage({ width: pageWidth, height: pageHeight });
  const layer = new Konva.Layer();

  const insertedFields = fields.filter((field) => field.inserted);

  // Render the fields onto the layer.
  for (const field of insertedFields) {
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
  return await canvas.toBuffer('pdf');
};
