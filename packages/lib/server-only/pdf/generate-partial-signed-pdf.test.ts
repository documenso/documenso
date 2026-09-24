import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDF } from '@libpdf/core';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  ZEnvelopeContentMetaSchema,
} from '../../types/envelope-content-meta';
import { generatePartialSignedPdf } from './generate-partial-signed-pdf';

/**
 * The fonts are resolved relative to the working directory of the app.
 */
beforeAll(() => {
  process.chdir(path.join(__dirname, '../../../../apps/remix'));
});

const examplePdf = readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

const rectangle = {
  id: 'envelope_content_rect',
  envelopeId: 'envelope_1',
  envelopeItemId: 'envelope_item_1',
  dataContentId: null,
  contentMeta: ZEnvelopeContentMetaSchema.parse({
    type: EnvelopeContentType.SHAPE,
    shape: EnvelopeContentShapeType.RECTANGLE,
    page: 1,
    rotation: 0,
    positionX: 10,
    positionY: 10,
    width: 30,
    height: 20,
    fillColor: '#ff0000',
    fillOpacity: 1,
  }),
};

describe('generatePartialSignedPdf', () => {
  it('produces a valid PDF when there is nothing to draw', async () => {
    const output = await generatePartialSignedPdf({ pdfData: examplePdf });

    const pdf = await PDF.load(output);

    expect(pdf.getPageCount()).toBe(1);
  });

  it('draws the contents onto the page', async () => {
    const output = await generatePartialSignedPdf({ pdfData: examplePdf, contents: [rectangle] });

    // The overlay is added as a new XObject, so the file must grow and must
    // still be a valid single page PDF.
    expect(output.byteLength).toBeGreaterThan(examplePdf.byteLength);

    const pdf = await PDF.load(output);

    expect(pdf.getPageCount()).toBe(1);
  });
});
