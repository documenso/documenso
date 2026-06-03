// ABOUTME: Cross-platform binary locator for system dependencies like qpdf and LibreOffice.
// ABOUTME: Tries `which`, then known paths, caches results, and throws with install instructions.
import * as childProcess from 'child_process';
import { access, constants } from 'fs/promises';
import { platform } from 'os';

import { AppError } from '../../errors/app-error';

const execFileAsync = async (
  cmd: string,
  args: string[],
  options: { timeout?: number },
): Promise<string> =>
  new Promise((resolve, reject) => {
    childProcess.execFile(cmd, args, options, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(typeof stdout === 'string' ? stdout : '');
      }
    });
  });

const KNOWN_PATHS: Record<string, string[]> = {
  soffice: [
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/snap/bin/libreoffice',
  ],
  qpdf: ['/usr/bin/qpdf', '/opt/homebrew/bin/qpdf', '/usr/local/bin/qpdf'],
};

const INSTALL_INSTRUCTIONS: Record<string, string> = {
  soffice:
    'Install LibreOffice:\n' +
    '  Debian/Ubuntu: apt install libreoffice-nogui\n' +
    '  RHEL/Amazon:   yum install libreoffice-headless\n' +
    '  macOS:         brew install --cask libreoffice',
  qpdf:
    'Install qpdf:\n' +
    '  Debian/Ubuntu: apt install qpdf\n' +
    '  RHEL/Amazon:   yum install qpdf\n' +
    '  macOS:         brew install qpdf',
};

const cache = new Map<string, string>();

export const clearBinaryCache = () => {
  cache.clear();
};

const tryWhich = async (name: string): Promise<string | null> => {
  const cmd = platform() === 'win32' ? 'where' : 'which';

  try {
    const stdout = await execFileAsync(cmd, [name], { timeout: 5000 });
    const firstLine = stdout.trim().split('\n')[0]?.trim();

    if (!firstLine || (!firstLine.startsWith('/') && platform() !== 'win32')) {
      return null;
    }

    return firstLine;
  } catch {
    return null;
  }
};

const tryKnownPaths = async (name: string): Promise<string | null> => {
  const paths = KNOWN_PATHS[name] ?? [];

  for (const p of paths) {
    try {
      await access(p, constants.X_OK);
      return p;
    } catch {
      continue;
    }
  }

  return null;
};

export const findBinary = async (name: string): Promise<string> => {
  const cached = cache.get(name);

  if (cached) {
    try {
      await access(cached, constants.X_OK);
      return cached;
    } catch {
      cache.delete(name);
    }
  }

  const whichResult = await tryWhich(name);

  if (whichResult) {
    cache.set(name, whichResult);
    return whichResult;
  }

  const knownResult = await tryKnownPaths(name);

  if (knownResult) {
    cache.set(name, knownResult);
    return knownResult;
  }

  const instructions =
    INSTALL_INSTRUCTIONS[name] ?? `Install ${name} and ensure it is in your PATH.`;

  throw new AppError('DEPENDENCY_MISSING', {
    message: `Required binary '${name}' not found.\n${instructions}`,
  });
};
