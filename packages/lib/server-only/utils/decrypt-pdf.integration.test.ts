// ABOUTME: Integration tests for encrypted PDF decryption using real qpdf binary.
// ABOUTME: Skips gracefully when qpdf is not installed; uses real encrypted PDF fixture.

import { readFile } from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { binaryExists } from './test-helpers';

const FIXTURE_DIR = path.resolve(__dirname, '../../../../test-fixtures');
const ENCRYPTED_FIXTURE = path.join(FIXTURE_DIR, 'encrypted-504.pdf');

describe.skipIf(!binaryExists('qpdf'))('decryptPdf (integration)', () => {
  it('should decrypt the real encrypted PDF fixture to a valid PDF', { timeout: 30_000 }, async () => {
    const { decryptPdf } = await import('./decrypt-pdf');
    const encryptedBuffer = await readFile(ENCRYPTED_FIXTURE);

    // The PowerSchool encrypted PDF uses an empty password
    const decryptedBuffer = await decryptPdf(encryptedBuffer);

    // Output must be a Buffer
    expect(decryptedBuffer).toBeInstanceOf(Buffer);

    // Must start with PDF magic bytes
    const header = decryptedBuffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');

    // Must have meaningful content (not empty)
    expect(decryptedBuffer.length).toBeGreaterThan(0);
  });

  it('should produce a decrypted PDF with non-trivial content', { timeout: 30_000 }, async () => {
    const { decryptPdf } = await import('./decrypt-pdf');
    const encryptedBuffer = await readFile(ENCRYPTED_FIXTURE);

    const decryptedBuffer = await decryptPdf(encryptedBuffer);

    expect(decryptedBuffer.length).toBeGreaterThan(100);
  });
});
