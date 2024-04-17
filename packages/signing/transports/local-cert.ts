<<<<<<< HEAD
import signer from 'node-signpdf';
import fs from 'node:fs';

import { addSigningPlaceholder } from '../helpers/addSigningPlaceholder';
=======
import fs from 'node:fs';

import { signWithP12 } from '@documenso/pdf-sign';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';
>>>>>>> main

export type SignWithLocalCertOptions = {
  pdf: Buffer;
};

export const signWithLocalCert = async ({ pdf }: SignWithLocalCertOptions) => {
<<<<<<< HEAD
  const pdfWithPlaceholder = await addSigningPlaceholder({ pdf });

  let p12Cert: Buffer | null = null;

  if (process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS) {
    p12Cert = Buffer.from(process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS, 'base64');
  }

  if (!p12Cert) {
    p12Cert = Buffer.from(
=======
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
    cert = Buffer.from(
>>>>>>> main
      fs.readFileSync(process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH || './example/cert.p12'),
    );
  }

<<<<<<< HEAD
  if (process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE) {
    return signer.sign(pdfWithPlaceholder, p12Cert, {
      passphrase: process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE,
    });
  }

  return signer.sign(pdfWithPlaceholder, p12Cert);
=======
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
>>>>>>> main
};
