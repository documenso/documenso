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
    console.error('Certificate error: Certificate not available for document signing');
    throw new Error('Document signing failed: Certificate not available');
  }

  let cert: Buffer | null = null;

  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    try {
      cert = Buffer.from(localFileContents, 'base64');
    } catch {
      throw new Error('Failed to decode certificate contents');
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
    } catch {
      console.error('Certificate error: Failed to read certificate file');
      throw new Error('Document signing failed: Certificate file not accessible');
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
