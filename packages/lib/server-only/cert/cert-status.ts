import * as fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

export type CertificateStatus = {
  isAvailable: boolean;
};

export const getCertificateStatus = (): CertificateStatus => {
  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    try {
      const decoded = Buffer.from(localFileContents, 'base64');
      return { isAvailable: decoded.length > 0 };
    } catch {
      return { isAvailable: false };
    }
  }

  const defaultPath =
    env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12';
  const filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;

  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);
    const stats = fs.statSync(filePath);
    return { isAvailable: stats.size > 0 };
  } catch {
    return { isAvailable: false };
  }
};

export const getCertificateHealthSummary = (): string => {
  const status = getCertificateStatus();
  return status.isAvailable ? '✅ Certificate configured' : '❌ Certificate not available';
};
