import { PDFDocument } from '@cantoo/pdf-lib';
import { FieldType } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { insertFieldInPDFV1 } from './insert-field-in-pdf-v1';

const fontDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/fonts');

// `insertFieldInPDFV1` fetches its fonts over HTTP from the internal webapp.
// Serve the bundled font files instead so the function can run in isolation.
const originalFetch = globalThis.fetch;

beforeAll(() => {
  process.env.NEXT_PRIVATE_INTERNAL_WEBAPP_URL = 'http://localhost:3000';

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const fileName = url.endsWith('caveat.ttf') ? 'caveat.ttf' : 'noto-sans.ttf';
    const buffer = await readFile(path.join(fontDir, fileName));

    return new Response(buffer);
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const buildField = (overrides: Partial<FieldWithSignature>): FieldWithSignature => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    id: 1,
    secondaryId: 'field_1',
    envelopeId: 'envelope_1',
    envelopeItemId: 'item_1',
    recipientId: 1,
    type: FieldType.NAME,
    page: 1,
    positionX: 20,
    positionY: 40,
    width: 20,
    height: 5,
    customText: 'John Doe',
    inserted: true,
    fieldMeta: null,
    signature: null,
    ...overrides,
  } as FieldWithSignature;
};

const createSinglePagePdf = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);

  return pdf;
};

describe('insertFieldInPDFV1', () => {
  it('renders NAME/DATE/INITIALS as centered drawn text instead of an AcroForm widget', async () => {
    for (const type of [FieldType.NAME, FieldType.DATE, FieldType.INITIALS] as const) {
      const pdf = await createSinglePagePdf();

      await insertFieldInPDFV1(pdf, buildField({ type, customText: 'Jane' }));

      // Drawn text does not create form fields, unlike the AcroForm text widget path.
      expect(pdf.getForm().getFields()).toHaveLength(0);

      // The document should still be saveable and contain the drawn page content.
      const bytes = await pdf.save();
      expect(bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('still renders TEXT fields as an AcroForm text widget', async () => {
    const pdf = await createSinglePagePdf();

    await insertFieldInPDFV1(pdf, buildField({ type: FieldType.TEXT, customText: 'Hello world' }));

    expect(pdf.getForm().getFields().length).toBeGreaterThan(0);
  });
});
