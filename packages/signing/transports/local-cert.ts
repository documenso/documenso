import fs from 'node:fs';

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
    pdfWithPlaceholder.subarray(0, byteRange[1]),
    pdfWithPlaceholder.subarray(byteRange[2]),
  ]);

  const signatureLength = byteRange[2] - byteRange[1];

  let cert: Buffer | null = null;

  if (process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS) {
    cert = Buffer.from(process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS, 'base64');
  }

  if (!cert) {
    let certPath = process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH || '/opt/documenso/cert.p12';

    // We don't want to make the development server suddenly crash when using the `dx` script
    // so we retain this when NODE_ENV isn't set to production which it should be in most production
    // deployments.
    //
    // Our docker image automatically sets this so it shouldn't be an issue for self-hosters.
    if (process.env.NODE_ENV !== 'production') {
      certPath = process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH || './example/cert.p12';
    }

    cert = Buffer.from(fs.readFileSync(certPath));
  }

  const signature = signWithP12({
    cert,
    content: pdfWithoutSignature,
    password: process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE || undefined,
  });

  const signatureAsHex = signature.toString('hex');

  const signedPdf = Buffer.concat([
    pdfWithPlaceholder.subarray(0, byteRange[1]),
    Buffer.from(`<${signatureAsHex.padEnd(signatureLength - 2, '0')}>`),
    pdfWithPlaceholder.subarray(byteRange[2]),
  ]);

  return signedPdf;
};
