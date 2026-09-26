// sort-imports-ignore
import '../konva/skia-backend';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import type { Canvas } from '@documenso/skia-canvas';
import type { EnvelopeContent } from '@prisma/client';
import Konva from 'konva';

import type { ContentImageMap } from '../../universal/content-renderer/content-renderer';
import { renderContent } from '../../universal/content-renderer/render-content';
import { renderField } from '../../universal/field-renderer/render-field';
import { sortContentsForRender } from '../../utils/envelope-content';
import { ensureFontLibrary } from './helpers';

export type OverlayContent = Pick<EnvelopeContent, 'id' | 'contentMeta' | 'dataContentId'>;

type InsertFieldInPDFV2Options = {
  pageWidth: number;
  pageHeight: number;
  fields: FieldWithSignature[];

  /**
   * The contents to render beneath the fields.
   */
  contents?: OverlayContent[];

  /**
   * The loaded images of the image contents, see `loadContentImages`.
   */
  images?: ContentImageMap;
};

/**
 * Render the given page's contents and fields into a single page PDF overlay,
 * to be embedded onto the original page.
 */
export const insertFieldInPDFV2 = async ({
  pageWidth,
  pageHeight,
  fields,
  contents = [],
  images,
}: InsertFieldInPDFV2Options) => {
  ensureFontLibrary();

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });
  let layer: Konva.Layer | null = new Konva.Layer();

  // Render the contents first so they sit beneath the fields, in stacking
  // order so the last one is on top.
  for (const content of sortContentsForRender(contents, (content) => content.contentMeta.zIndex)) {
    renderContent(
      {
        renderId: content.id,
        contentMeta: content.contentMeta,
        dataContentId: content.dataContentId,
      },
      {
        scale: 1,
        pageLayer: layer,
        pageWidth,
        pageHeight,
        mode: 'export',
        images,
      },
    );
  }

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
