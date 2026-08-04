import fs from 'node:fs';
import path from 'node:path';

import { PDFDocument } from '@cantoo/pdf-lib';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { FieldType } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { insertFieldInPDFV1 } from './insert-field-in-pdf-v1';

describe('insertFieldInPDFV1', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws bold and italic text styles into the final PDF output', async () => {
    const fontBytes = fs.readFileSync(path.join(process.cwd(), '../assets/fonts/noto-sans.ttf'));

    vi.stubGlobal('fetch', async () => ({
      arrayBuffer: async () =>
        fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength),
    }));

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 400]);
    const drawText = vi.spyOn(page, 'drawText');

    await insertFieldInPDFV1(pdf, {
      id: 1,
      secondaryId: 'styled-text',
      type: FieldType.TEXT,
      page: 1,
      positionX: 10,
      positionY: 10,
      width: 40,
      height: 10,
      customText: 'Styled final text',
      fieldMeta: {
        type: 'text',
        fontSize: 14,
        fontWeight: 'bold',
        fontStyle: 'italic',
      },
    } as unknown as FieldWithSignature);

    const styledTextDraws = drawText.mock.calls.filter(([text]) => text === 'Styled final text');

    expect(styledTextDraws).toHaveLength(3);
    expect(styledTextDraws.every(([, options]) => options && 'xSkew' in options)).toBe(true);
  });
});
