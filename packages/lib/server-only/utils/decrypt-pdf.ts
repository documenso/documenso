// ABOUTME: Decrypts password-protected PDF files using qpdf as an external process.
// ABOUTME: Writes to a private temp directory, invokes qpdf --decrypt, reads output, and cleans up the whole directory.
import * as childProcess from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { AppError } from '../../errors/app-error';
import { findBinary } from './find-binary';

const QPDF_TIMEOUT_MS = 30_000;
const QPDF_EXIT_BAD_PASSWORD = 2;

const execFileAsync = async (
  cmd: string,
  args: string[],
  options: { timeout?: number; killSignal?: NodeJS.Signals },
): Promise<void> =>
  await new Promise((resolve, reject) => {
    childProcess.execFile(cmd, args, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

export const decryptPdf = async (pdf: Buffer, password = ''): Promise<Buffer> => {
  const qpdfPath = await findBinary('qpdf');

  const tmpDir = await mkdtemp(join(tmpdir(), 'documenso-decrypt-'));
  const inputPath = join(tmpDir, 'input.pdf');
  const outputPath = join(tmpDir, 'output.pdf');

  try {
    await writeFile(inputPath, pdf, { mode: 0o600 });

    await execFileAsync(qpdfPath, [`--password=${password}`, '--decrypt', inputPath, outputPath], {
      timeout: QPDF_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });

    return await readFile(outputPath);
  } catch (err) {
    if (err instanceof AppError) throw err;

    const isErrorObject = typeof err === 'object' && err !== null;

    const killed = isErrorObject && 'killed' in err ? err.killed : undefined;

    if (killed) {
      throw new AppError('DECRYPTION_TIMEOUT', {
        message: `qpdf timed out after ${QPDF_TIMEOUT_MS / 1000}s`,
      });
    }

    const code = isErrorObject && 'code' in err ? err.code : undefined;

    if (Number(code) === QPDF_EXIT_BAD_PASSWORD) {
      throw new AppError('ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD', {
        message:
          'This PDF is password-protected. Please remove the password or export an unencrypted version.',
      });
    }

    const rawMessage = isErrorObject && 'message' in err ? err.message : undefined;
    const message =
      rawMessage === undefined || rawMessage === null ? String(err) : String(rawMessage);

    throw new AppError('DECRYPTION_FAILED', {
      message: `qpdf decryption failed: ${message}`,
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
