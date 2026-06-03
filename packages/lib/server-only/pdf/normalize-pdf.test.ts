// ABOUTME: Unit tests for normalize-pdf covering unencrypted, encrypted, annotation flattening, and error branches.
// ABOUTME: Mocks @libpdf/core and decrypt-pdf to isolate normalize-pdf logic without real dependencies.

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions, @typescript-eslint/require-await */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFlattenLayers = vi.fn();
const mockFlattenAnnotations = vi.fn();
const mockSave = vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

vi.mock('@libpdf/core', () => ({
  PDF: {
    load: vi.fn().mockResolvedValue({
      isEncrypted: false,
      flattenLayers: mockFlattenLayers,
      flattenAnnotations: mockFlattenAnnotations,
      save: mockSave,
    }),
  },
}));

vi.mock('../utils/decrypt-pdf', () => ({
  decryptPdf: vi.fn().mockResolvedValue(Buffer.from('decrypted pdf content')),
}));

describe('normalizePdf', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should normalize an unencrypted PDF with annotation flattening (default)', async () => {
    const { PDF } = await import('@libpdf/core');

    const mockDoc = {
      isEncrypted: false,
      flattenLayers: mockFlattenLayers,
      flattenAnnotations: mockFlattenAnnotations,
      save: mockSave,
    };

    vi.mocked(PDF.load).mockResolvedValue(mockDoc as any);

    const { normalizePdf } = await import('./normalize-pdf');
    const result = await normalizePdf(Buffer.from('valid pdf'));

    expect(result).toBeInstanceOf(Buffer);
    expect(mockFlattenLayers).toHaveBeenCalled();
    expect(mockFlattenAnnotations).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  it('should skip annotation flattening when flattenForm is false', async () => {
    const { PDF } = await import('@libpdf/core');

    const mockDoc = {
      isEncrypted: false,
      flattenLayers: mockFlattenLayers,
      flattenAnnotations: mockFlattenAnnotations,
      save: mockSave,
    };

    vi.mocked(PDF.load).mockResolvedValue(mockDoc as any);

    const { normalizePdf } = await import('./normalize-pdf');
    await normalizePdf(Buffer.from('valid pdf'), { flattenForm: false });

    expect(mockFlattenLayers).toHaveBeenCalled();
    expect(mockFlattenAnnotations).not.toHaveBeenCalled();
  });

  it('should decrypt encrypted PDFs before normalizing', async () => {
    const { PDF } = await import('@libpdf/core');
    const { decryptPdf } = await import('../utils/decrypt-pdf');

    const encryptedDoc = {
      isEncrypted: true,
      flattenLayers: vi.fn(),
      flattenAnnotations: vi.fn(),
      save: vi.fn(),
    };

    const decryptedDoc = {
      isEncrypted: false,
      flattenLayers: vi.fn(),
      flattenAnnotations: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50])),
    };

    vi.mocked(PDF.load)
      .mockResolvedValueOnce(encryptedDoc as any)
      .mockResolvedValueOnce(decryptedDoc as any);

    const { normalizePdf } = await import('./normalize-pdf');
    const result = await normalizePdf(Buffer.from('encrypted pdf'));

    expect(result).toBeInstanceOf(Buffer);
    expect(decryptPdf).toHaveBeenCalledWith(Buffer.from('encrypted pdf'));
    expect(decryptedDoc.flattenLayers).toHaveBeenCalled();
    expect(decryptedDoc.flattenAnnotations).toHaveBeenCalled();
  });

  it('should skip annotation flattening on decrypted PDF when flattenForm is false', async () => {
    const { PDF } = await import('@libpdf/core');

    const encryptedDoc = {
      isEncrypted: true,
      flattenLayers: vi.fn(),
      flattenAnnotations: vi.fn(),
      save: vi.fn(),
    };

    const decryptedDoc = {
      isEncrypted: false,
      flattenLayers: vi.fn(),
      flattenAnnotations: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array([0x25])),
    };

    vi.mocked(PDF.load)
      .mockResolvedValueOnce(encryptedDoc as any)
      .mockResolvedValueOnce(decryptedDoc as any);

    const { normalizePdf } = await import('./normalize-pdf');
    await normalizePdf(Buffer.from('encrypted pdf'), { flattenForm: false });

    expect(decryptedDoc.flattenLayers).toHaveBeenCalled();
    expect(decryptedDoc.flattenAnnotations).not.toHaveBeenCalled();
  });

  it('should throw INVALID_DOCUMENT_FILE when PDF.load fails', async () => {
    const { PDF } = await import('@libpdf/core');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(PDF.load).mockRejectedValue(new Error('Not a valid PDF'));

    const { normalizePdf } = await import('./normalize-pdf');

    await expect(normalizePdf(Buffer.from('garbage'))).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_FILE',
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('PDF normalization error'));
    spy.mockRestore();
  });

  it('should throw INVALID_DOCUMENT_FILE when PDF.load fails after decryption', async () => {
    const { PDF } = await import('@libpdf/core');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const encryptedDoc = {
      isEncrypted: true,
      flattenLayers: vi.fn(),
      flattenAnnotations: vi.fn(),
      save: vi.fn(),
    };

    vi.mocked(PDF.load)
      .mockResolvedValueOnce(encryptedDoc as any)
      .mockRejectedValueOnce(new Error('Decrypted PDF is corrupt'));

    const { normalizePdf } = await import('./normalize-pdf');

    await expect(normalizePdf(Buffer.from('bad encrypted'))).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_FILE',
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('PDF normalization error'));
    spy.mockRestore();
  });
});
