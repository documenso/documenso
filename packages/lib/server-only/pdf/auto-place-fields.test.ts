import { PDF } from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { extractPlaceholdersFromPDF } from './auto-place-fields';

const buildPdf = async (lines: string[]) => {
  const pdf = PDF.create();
  const page = pdf.addPage({ size: 'letter' });

  lines.forEach((line, index) => {
    page.drawText(line, { x: 40, y: 720 - index * 30, size: 9, font: 'Helvetica' });
  });

  return Buffer.from(await pdf.save());
};

describe('extractPlaceholdersFromPDF', () => {
  it('parses option lists for checkbox, radio and dropdown placeholders', async () => {
    const pdf = await buildPdf([
      '{{checkbox, r1, values="Option A, detailed|Option B|100\\%", default=Option B, required=true}}',
      '{{radio, r1, options=Yes|No, default=No, label=Confirm}}',
      '{{dropdown, r2, values=Red|Green|Blue, default=Green}}',
      '{{text, r1, label=Company Name}}',
    ]);

    const placeholders = await extractPlaceholdersFromPDF(pdf);

    expect(placeholders.map((p) => [p.recipient, p.fieldAndMeta])).toEqual([
      [
        'r1',
        expect.objectContaining({
          type: FieldType.CHECKBOX,
          fieldMeta: expect.objectContaining({
            type: 'checkbox',
            required: true,
            values: [
              { id: 1, checked: false, value: 'Option A, detailed' },
              { id: 2, checked: true, value: 'Option B' },
              { id: 3, checked: false, value: '100%' },
            ],
          }),
        }),
      ],
      [
        'r1',
        expect.objectContaining({
          type: FieldType.RADIO,
          fieldMeta: expect.objectContaining({
            type: 'radio',
            label: 'Confirm',
            values: [
              { id: 1, checked: false, value: 'Yes' },
              { id: 2, checked: true, value: 'No' },
            ],
          }),
        }),
      ],
      [
        'r2',
        expect.objectContaining({
          type: FieldType.DROPDOWN,
          fieldMeta: expect.objectContaining({
            type: 'dropdown',
            values: [{ value: 'Red' }, { value: 'Green' }, { value: 'Blue' }],
            defaultValue: 'Green',
          }),
        }),
      ],
      [
        'r1',
        expect.objectContaining({
          type: FieldType.TEXT,
          fieldMeta: expect.objectContaining({ type: 'text', label: 'Company Name' }),
        }),
      ],
    ]);
  });

  it('names the placeholder and page when an option list is invalid', async () => {
    const pdf = await buildPdf(['{{radio, r1, values=Yes|No|Yes}}']);

    await expect(extractPlaceholdersFromPDF(pdf)).rejects.toThrow(
      'Invalid placeholder {{radio, r1, values=Yes|No|Yes}} on page 1: Option "Yes" is listed more than once',
    );
  });
});
