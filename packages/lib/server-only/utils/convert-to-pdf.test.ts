// ABOUTME: Tests for convert-to-pdf utility covering validation, conversion, timeout, and cleanup.
// ABOUTME: Mocks find-binary and child_process to avoid real LibreOffice dependency in tests.

import type { ExecFileException } from 'child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./find-binary', () => ({
  findBinary: vi.fn().mockResolvedValue('/usr/bin/soffice'),
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('pdf output')),
  rm: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue('/tmp/convert-abc123'),
  access: vi.fn().mockResolvedValue(undefined),
}));

// Valid DOCX magic bytes (PK ZIP header)
const VALID_DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(100)]);
// Valid DOC magic bytes (CFBF header)
const VALID_DOC = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(100)]);

describe('convertToPdf', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should return a PDF buffer on successful conversion', async () => {
    const childProcess = await import('child_process');
    const fsPromises = await import('fs/promises');

    vi.mocked(fsPromises.mkdtemp).mockResolvedValue('/tmp/convert-abc123');
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('converted pdf'));
    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        callback?.(null, '', '');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    const result = await convertToPdf(VALID_DOCX, 'docx');

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('converted pdf');
  });

  it('should accept valid .doc files with CFBF header', async () => {
    const childProcess = await import('child_process');
    const fsPromises = await import('fs/promises');

    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('pdf'));
    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        callback?.(null, '', '');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    const result = await convertToPdf(VALID_DOC, 'doc');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should reject files with invalid magic bytes', async () => {
    const { convertToPdf } = await import('./convert-to-pdf');
    const notDocx = Buffer.from('This is plain text, not a DOCX');

    await expect(convertToPdf(notDocx, 'docx')).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_FILE',
    });
  });

  it('should reject files larger than 25MB', async () => {
    const { convertToPdf } = await import('./convert-to-pdf');
    const largeBuffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(26 * 1024 * 1024)]);

    await expect(convertToPdf(largeBuffer, 'docx')).rejects.toMatchObject({
      code: 'CONVERSION_FAILED',
    });
  });

  it('should invoke soffice with --convert-to pdf and --outdir flags', async () => {
    const childProcess = await import('child_process');
    const fsPromises = await import('fs/promises');

    let capturedArgs: readonly string[] = [];
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('pdf'));
    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, args, _opts, callback) => {
        if (Array.isArray(args)) {
          capturedArgs = args;
        }
        callback?.(null, '', '');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    await convertToPdf(VALID_DOCX, 'docx');

    expect(capturedArgs).toContain('--convert-to');
    expect(capturedArgs).toContain('pdf');
    expect(capturedArgs).toContain('--outdir');
    expect(capturedArgs).toContain('--headless');
  });

  it('should throw CONVERSION_FAILED when soffice exits with error', async () => {
    const childProcess = await import('child_process');

    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        const err: ExecFileException = Object.assign(new Error('soffice crashed'), { code: 1 });
        callback?.(err, '', 'crashed');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    await expect(convertToPdf(VALID_DOCX, 'docx')).rejects.toMatchObject({
      code: 'CONVERSION_FAILED',
    });
  });

  it('should throw CONVERSION_TIMEOUT when soffice times out', async () => {
    const childProcess = await import('child_process');

    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        const err: ExecFileException = Object.assign(new Error('timed out'), { killed: true });
        callback?.(err, '', '');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    await expect(convertToPdf(VALID_DOCX, 'docx')).rejects.toMatchObject({
      code: 'CONVERSION_TIMEOUT',
    });
  });

  it('should clean up temp directory after success', async () => {
    const childProcess = await import('child_process');
    const fsPromises = await import('fs/promises');

    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('pdf'));
    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        callback?.(null, '', '');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    await convertToPdf(VALID_DOCX, 'docx');

    expect(fsPromises.rm).toHaveBeenCalledWith('/tmp/convert-abc123', { recursive: true, force: true });
  });

  it('should clean up temp directory after failure', async () => {
    const childProcess = await import('child_process');
    const fsPromises = await import('fs/promises');

    vi.mocked(childProcess.execFile, { partial: true }).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        const err: ExecFileException = Object.assign(new Error('fail'), { code: 1 });
        callback?.(err, '', '');
        return {};
      },
    );

    const { convertToPdf } = await import('./convert-to-pdf');
    await expect(convertToPdf(VALID_DOCX, 'docx')).rejects.toBeDefined();

    expect(fsPromises.rm).toHaveBeenCalledWith('/tmp/convert-abc123', { recursive: true, force: true });
  });
});
