// ABOUTME: Tests for decrypt-pdf utility covering successful decryption, wrong password, and cleanup.
// ABOUTME: Mocks find-binary and child_process to avoid real qpdf dependency in tests.

import type { ExecFileException } from 'child_process';
import * as childProcess from 'child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./find-binary', () => ({
  findBinary: vi.fn().mockResolvedValue('/usr/bin/qpdf'),
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');

  return {
    ...actual,
    execFile: vi.fn(),
  };
});

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('decrypted pdf content')),
  rm: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue('/tmp/decrypt-abc123'),
}));

// execFile is heavily overloaded, so its mock implementation must return a ChildProcess.
// The code under test ignores the return value, so a real (unspawned) instance is a safe stub.
const createChildStub = () => new childProcess.ChildProcess();

describe('decryptPdf', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should return decrypted PDF buffer on success', async () => {
    const fsPromises = await import('fs/promises');

    vi.mocked(fsPromises.mkdtemp).mockResolvedValue('/tmp/decrypt-abc123');
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('decrypted content'));
    vi.mocked(childProcess.execFile).mockImplementation((_cmd, _args, _opts, callback) => {
      callback?.(null, '', '');
      return createChildStub();
    });

    const { decryptPdf } = await import('./decrypt-pdf');
    const result = await decryptPdf(Buffer.from('encrypted pdf'), 'secret');

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('decrypted content');
  });

  it('should throw ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD when qpdf exits with bad password', async () => {
    vi.mocked(childProcess.execFile).mockImplementation((_cmd, _args, _opts, callback) => {
      const err: ExecFileException = Object.assign(new Error('bad password'), { code: 2 });
      callback?.(err, '', 'invalid password');
      return createChildStub();
    });

    const { decryptPdf } = await import('./decrypt-pdf');
    await expect(decryptPdf(Buffer.from('pdf'), 'wrong')).rejects.toMatchObject({
      code: 'ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD',
    });
  });

  it('should throw DECRYPTION_FAILED when qpdf exits with a non-password error', async () => {
    vi.mocked(childProcess.execFile).mockImplementation((_cmd, _args, _opts, callback) => {
      const err: ExecFileException = Object.assign(new Error('damaged pdf'), { code: 3 });
      callback?.(err, '', 'structural error');
      return createChildStub();
    });

    const { decryptPdf } = await import('./decrypt-pdf');
    await expect(decryptPdf(Buffer.from('pdf'), 'pass')).rejects.toMatchObject({
      code: 'DECRYPTION_FAILED',
    });
  });

  it('should pass empty string password when none provided', async () => {
    const fsPromises = await import('fs/promises');

    let capturedArgs: readonly string[] = [];
    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('output'));
    vi.mocked(childProcess.execFile).mockImplementation((_cmd, args, _opts, callback) => {
      capturedArgs = args ?? [];
      callback?.(null, '', '');
      return createChildStub();
    });

    const { decryptPdf } = await import('./decrypt-pdf');
    await decryptPdf(Buffer.from('pdf'));

    expect(capturedArgs).toContain('--password=');
  });

  it('should clean up temp directory after success', async () => {
    const fsPromises = await import('fs/promises');

    vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('output'));
    vi.mocked(childProcess.execFile).mockImplementation((_cmd, _args, _opts, callback) => {
      callback?.(null, '', '');
      return createChildStub();
    });

    const { decryptPdf } = await import('./decrypt-pdf');
    await decryptPdf(Buffer.from('pdf'), 'pass');

    expect(fsPromises.rm).toHaveBeenCalledWith('/tmp/decrypt-abc123', { recursive: true, force: true });
  });

  it('should clean up temp directory after failure', async () => {
    const fsPromises = await import('fs/promises');

    vi.mocked(childProcess.execFile).mockImplementation((_cmd, _args, _opts, callback) => {
      const err: ExecFileException = Object.assign(new Error('fail'), { code: 2 });
      callback?.(err, '', '');
      return createChildStub();
    });

    const { decryptPdf } = await import('./decrypt-pdf');

    await expect(decryptPdf(Buffer.from('pdf'), 'pass')).rejects.toBeDefined();
    expect(fsPromises.rm).toHaveBeenCalledWith('/tmp/decrypt-abc123', { recursive: true, force: true });
  });
});
