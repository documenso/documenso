import * as fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

export type CertificateStatus = {
  isAvailable: boolean;
  hasContents: boolean;
  hasFile: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
  recommendations: string[];
};

export const getCertificateStatus = (): CertificateStatus => {
  const recommendations: string[] = [];
  let isAvailable = false;
  let hasContents = false;
  let hasFile = false;
  let filePath: string | undefined;
  let fileSize: number | undefined;
  let error: string | undefined;

  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    try {
      const decoded = Buffer.from(localFileContents, 'base64');
      if (decoded.length > 0) {
        hasContents = true;
        isAvailable = true;
        fileSize = decoded.length;
      } else {
        error = 'Base64 certificate contents are empty';
        recommendations.push(
          'Verify that NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS contains valid base64 data',
        );
      }
    } catch (e) {
      error = 'Invalid base64 certificate contents';
      recommendations.push(
        'Check that NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS is properly base64 encoded',
      );
    }
  } else {
    const defaultPath =
      env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12';

    filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;

    try {
      fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

      const stats = fs.statSync(filePath);
      fileSize = stats.size;
      hasFile = true;

      if (fileSize > 0) {
        isAvailable = true;
      } else {
        error = 'Certificate file is empty';
        recommendations.push('Ensure you have a valid .p12 certificate file');
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('ENOENT')) {
          error = `Certificate file not found at ${filePath}`;
          recommendations.push('Create or mount a .p12 certificate file');
          recommendations.push(
            'Or use NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS with base64 encoded certificate',
          );
        } else if (e.message.includes('EACCES')) {
          error = `Cannot read certificate file at ${filePath} - permission denied`;
          recommendations.push('Fix file permissions: chmod 644 /path/to/cert.p12');
          recommendations.push('For Docker: chown 1001:1001 /path/to/cert.p12');
        } else {
          error = `Failed to access certificate file: ${e.message}`;
        }
      } else {
        error = 'Unknown error accessing certificate file';
      }
    }
  }

  if (!isAvailable) {
    recommendations.push(
      'See documentation: https://docs.documenso.com/developers/self-hosting/signing-certificate',
    );
    if (env('NODE_ENV') === 'production') {
      recommendations.push('Use automated setup: curl -fsSL https://get.documenso.com/setup | sh');
    }
  }

  return {
    isAvailable,
    hasContents,
    hasFile,
    filePath,
    fileSize,
    error,
    recommendations,
  };
};

export const getCertificateHealthSummary = (): string => {
  const status = getCertificateStatus();

  if (status.isAvailable) {
    const source = status.hasContents ? 'environment variable' : 'file';
    const size = status.fileSize ? ` (${status.fileSize} bytes)` : '';
    return `✅ Certificate available from ${source}${size}`;
  } else {
    return `❌ Certificate not available: ${status.error}`;
  }
};
