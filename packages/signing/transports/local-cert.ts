import * as fs from 'node:fs';

import { getCertificateStatus } from '@documenso/lib/server-only/cert/cert-status';
import { env } from '@documenso/lib/utils/env';
import { signWithP12 } from '@documenso/pdf-sign';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';

export type SignWithLocalCertOptions = {
  pdf: Buffer;
};

export const signWithLocalCert = async ({ pdf }: SignWithLocalCertOptions) => {
  const { pdf: pdfWithPlaceholder, byteRange } = updateSigningPlaceholder({
    pdf: await addSigningPlaceholder({ pdf }),
  });

  const pdfWithoutSignature = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  const signatureLength = byteRange[2] - byteRange[1];

  const certStatus = getCertificateStatus();

  if (!certStatus.isAvailable) {
    const errorMessage = [
      '🚫 Document signing failed: Certificate not available',
      '',
      `❌ Issue: ${certStatus.error}`,
      '',
      '🛠️  Solutions:',
      ...certStatus.recommendations.map((rec) => `   • ${rec}`),
      '',
      '📚 For detailed setup instructions, visit:',
      '   https://docs.documenso.com/developers/self-hosting/signing-certificate',
    ].join('\n');

    console.error('Certificate error:', errorMessage);
    throw new Error(errorMessage);
  }

  let cert: Buffer | null = null;

  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    try {
      cert = Buffer.from(localFileContents, 'base64');
    } catch (error) {
      throw new Error(
        `Failed to decode base64 certificate contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  if (!cert) {
    let certPath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || '/opt/documenso/cert.p12';

    // We don't want to make the development server suddenly crash when using the `dx` script
    // so we retain this when NODE_ENV isn't set to production which it should be in most production
    // deployments.
    //
    // Our docker image automatically sets this so it shouldn't be an issue for self-hosters.
    if (env('NODE_ENV') !== 'production') {
      certPath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || './example/cert.p12';
    }

    try {
      cert = Buffer.from(fs.readFileSync(certPath));
    } catch (error) {
      // This shouldn't happen since we already checked in getCertificateStatus, but just in case
      const errorMessage = `Failed to read certificate file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('Certificate reading error:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  const signature = signWithP12({
    cert,
    content: pdfWithoutSignature,
    password: env('NEXT_PRIVATE_SIGNING_PASSPHRASE') || undefined,
  });

  const signatureAsHex = signature.toString('hex');

  const signedPdf = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(Buffer.from(`<${signatureAsHex.padEnd(signatureLength - 2, '0')}>`)),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  return signedPdf;
};
