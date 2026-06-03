// ABOUTME: Integration tests for DOCX-to-PDF conversion using real LibreOffice soffice binary.
// ABOUTME: Skips gracefully when soffice is not installed; uses real fixture files from test-fixtures/.

import { readFile } from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { binaryExists } from './test-helpers';

const FIXTURE_DIR = path.resolve(__dirname, '../../../../test-fixtures');
const DOCX_FIXTURE = path.join(FIXTURE_DIR, 'test-healthcare-plan.docx');

describe.skipIf(!binaryExists('soffice'))('convertToPdf (integration)', () => {
  it('should convert a real DOCX fixture to a valid PDF', { timeout: 60_000 }, async () => {
    const { convertToPdf } = await import('./convert-to-pdf');
    const docxBuffer = await readFile(DOCX_FIXTURE);

    const pdfBuffer = await convertToPdf(docxBuffer, 'docx');

    expect(pdfBuffer).toBeInstanceOf(Buffer);

    const header = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');

    expect(pdfBuffer.length).toBeGreaterThan(100);
  });
});

describe('convertToPdf (validation)', () => {
  it('should reject a file with invalid magic bytes', async () => {
    const { convertToPdf } = await import('./convert-to-pdf');
    const plainText = Buffer.from('This is not a DOCX file at all');

    await expect(convertToPdf(plainText, 'docx')).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_FILE',
    });
  });
});
