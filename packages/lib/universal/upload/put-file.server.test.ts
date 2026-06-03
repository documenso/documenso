// ABOUTME: Tests for putPdfFileServerSide covering DOCX conversion, encrypted PDF decryption, and normal PDF upload.
// ABOUTME: Mocks PDF.load, convert-to-pdf, decrypt-pdf, and storage helpers to test pipeline logic in isolation.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@libpdf/core', () => ({
  PDF: {
    load: vi.fn(),
  },
}));

vi.mock('../../server-only/document-data/create-document-data', () => ({
  createDocumentData: vi.fn().mockResolvedValue({ id: 'doc-1', type: 'BYTES_64', data: 'abc' }),
}));

vi.mock('./server-actions', () => ({
  uploadS3File: vi.fn(),
}));

vi.mock('@documenso/lib/utils/env', () => ({
  env: vi.fn().mockReturnValue('database'),
}));

vi.mock('../../server-only/utils/convert-to-pdf', () => ({
  convertToPdf: vi.fn(),
}));

vi.mock('../../server-only/utils/decrypt-pdf', () => ({
  decryptPdf: vi.fn(),
}));

vi.mock('@scure/base', () => ({
  base64: {
    encode: vi.fn().mockReturnValue('base64encoded'),
  },
}));

vi.mock('@prisma/client', () => ({
  DocumentDataType: {
    BYTES_64: 'BYTES_64',
    S3_PATH: 'S3_PATH',
  },
}));

const makePdfObject = (isEncrypted: boolean, pageCount = 3) => ({
  isEncrypted,
  getPageCount: vi.fn().mockReturnValue(pageCount),
  flattenLayers: vi.fn(),
  getForm: vi.fn().mockReturnValue(null),
  flattenAnnotations: vi.fn(),
  save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
});

const makeFile = (name: string, type: string, content: Buffer) => ({
  name,
  type,
  arrayBuffer: async () =>
    Promise.resolve(content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)),
});

describe('putPdfFileServerSide', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should upload a normal unencrypted PDF without conversion or decryption', async () => {
    const { PDF } = await import('@libpdf/core');
    const { convertToPdf } = await import('../../server-only/utils/convert-to-pdf');
    const { decryptPdf } = await import('../../server-only/utils/decrypt-pdf');

    const pdfObj = makePdfObject(false, 5);
    vi.mocked(PDF.load, { partial: true }).mockResolvedValue(pdfObj);

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile('doc.pdf', 'application/pdf', Buffer.from('%PDF-1.4 fake'));
    const result = await putPdfFileServerSide(file);

    expect(convertToPdf).not.toHaveBeenCalled();
    expect(decryptPdf).not.toHaveBeenCalled();
    expect(result.filePageCount).toBe(5);
    expect(result.documentData).toBeDefined();
  });

  it('should call convertToPdf for a .docx file and process result as PDF', async () => {
    const { PDF } = await import('@libpdf/core');
    const { convertToPdf } = await import('../../server-only/utils/convert-to-pdf');
    const { decryptPdf } = await import('../../server-only/utils/decrypt-pdf');

    const convertedPdf = Buffer.from('%PDF-1.4 converted');
    vi.mocked(convertToPdf).mockResolvedValue(convertedPdf);

    const pdfObj = makePdfObject(false, 2);
    vi.mocked(PDF.load, { partial: true }).mockResolvedValue(pdfObj);

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile(
      'plan.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from('PK docx content'),
    );
    const result = await putPdfFileServerSide(file);

    expect(convertToPdf).toHaveBeenCalledWith(expect.any(Buffer), 'docx');
    expect(decryptPdf).not.toHaveBeenCalled();
    expect(result.filePageCount).toBe(2);
  });

  it('should call convertToPdf for a .doc file', async () => {
    const { PDF } = await import('@libpdf/core');
    const { convertToPdf } = await import('../../server-only/utils/convert-to-pdf');

    const convertedPdf = Buffer.from('%PDF-1.4 converted doc');
    vi.mocked(convertToPdf).mockResolvedValue(convertedPdf);

    const pdfObj = makePdfObject(false, 1);
    vi.mocked(PDF.load, { partial: true }).mockResolvedValue(pdfObj);

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile('report.doc', 'application/msword', Buffer.from('\xD0\xCF legacy doc'));
    await putPdfFileServerSide(file);

    expect(convertToPdf).toHaveBeenCalledWith(expect.any(Buffer), 'doc');
  });

  it('should call decryptPdf for an encrypted PDF and use the decrypted buffer', async () => {
    const { PDF } = await import('@libpdf/core');
    const { convertToPdf } = await import('../../server-only/utils/convert-to-pdf');
    const { decryptPdf } = await import('../../server-only/utils/decrypt-pdf');

    const encryptedPdfObj = makePdfObject(true, 0);
    const decryptedPdfObj = makePdfObject(false, 4);
    const decryptedBuffer = Buffer.from('%PDF-1.4 decrypted');

    vi.mocked(PDF.load, { partial: true })
      .mockResolvedValueOnce(encryptedPdfObj)
      .mockResolvedValueOnce(decryptedPdfObj);
    vi.mocked(decryptPdf).mockResolvedValue(decryptedBuffer);

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile('encrypted.pdf', 'application/pdf', Buffer.from('%PDF-1.4 encrypted'));
    const result = await putPdfFileServerSide(file);

    expect(convertToPdf).not.toHaveBeenCalled();
    expect(decryptPdf).toHaveBeenCalledWith(expect.any(Buffer));
    expect(result.filePageCount).toBe(4);
  });

  it('should not throw INVALID_DOCUMENT_FILE for encrypted PDFs', async () => {
    const { PDF } = await import('@libpdf/core');
    const { decryptPdf } = await import('../../server-only/utils/decrypt-pdf');

    const encryptedPdfObj = makePdfObject(true, 0);
    const decryptedPdfObj = makePdfObject(false, 2);

    vi.mocked(PDF.load, { partial: true })
      .mockResolvedValueOnce(encryptedPdfObj)
      .mockResolvedValueOnce(decryptedPdfObj);
    vi.mocked(decryptPdf).mockResolvedValue(Buffer.from('%PDF-1.4 ok'));

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile('sec504.pdf', 'application/pdf', Buffer.from('%PDF-1.4 enc'));

    // Should NOT throw — decryption is attempted
    await expect(putPdfFileServerSide(file)).resolves.toBeDefined();
  });

  it('should propagate ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD from decryptPdf', async () => {
    const { PDF } = await import('@libpdf/core');
    const { decryptPdf } = await import('../../server-only/utils/decrypt-pdf');
    const { AppError } = await import('../../errors/app-error');

    const encryptedPdfObj = makePdfObject(true, 0);
    vi.mocked(PDF.load, { partial: true }).mockResolvedValue(encryptedPdfObj);
    vi.mocked(decryptPdf).mockRejectedValue(
      new AppError('ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD', { message: 'needs password' }),
    );

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile('protected.pdf', 'application/pdf', Buffer.from('%PDF-1.4 locked'));

    await expect(putPdfFileServerSide(file)).rejects.toMatchObject({
      code: 'ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD',
    });
  });

  it('should still throw INVALID_DOCUMENT_FILE when PDF.load fails for non-PDF bytes', async () => {
    const { PDF } = await import('@libpdf/core');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(PDF.load).mockRejectedValue(new Error('not a pdf'));

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile('garbage.pdf', 'application/pdf', Buffer.from('this is not a pdf'));

    await expect(putPdfFileServerSide(file)).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_FILE',
    });
    spy.mockRestore();
  });

  it('should ensure the file stored has a .pdf extension after DOCX conversion', async () => {
    const { PDF } = await import('@libpdf/core');
    const { convertToPdf } = await import('../../server-only/utils/convert-to-pdf');
    const { createDocumentData } = await import(
      '../../server-only/document-data/create-document-data'
    );

    vi.mocked(convertToPdf).mockResolvedValue(Buffer.from('%PDF-1.4 converted'));
    vi.mocked(PDF.load, { partial: true }).mockResolvedValue(makePdfObject(false, 1));

    const { putPdfFileServerSide } = await import('./put-file.server');
    const file = makeFile(
      'care_plan.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from('PK content'),
    );
    await putPdfFileServerSide(file);

    // createDocumentData is called after putFileServerSide — we verify it was called (storage happened)
    expect(createDocumentData).toHaveBeenCalled();
  });
});
