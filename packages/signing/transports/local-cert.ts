import { P12Signer } from '@signpdf/signer-p12';
import signpdf from '@signpdf/signpdf';
import fs from 'node:fs';

import { addSigningPlaceholder } from '../helpers/addSigningPlaceholder';

export type SignWithLocalCertOptions = {
  pdf: Buffer;
};

export const signWithLocalCert = async ({ pdf }: SignWithLocalCertOptions) => {
  const pdfWithPlaceholder = await addSigningPlaceholder({ pdf });

  let p12Cert: Buffer | null = null;

  if (process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS) {
    p12Cert = Buffer.from(process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS, 'base64');
  }

  if (!p12Cert) {
    p12Cert = Buffer.from(
      fs.readFileSync(process.env.NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH || './example/cert.p12'),
    );
  }

  let signer = new P12Signer(p12Cert);

  if (process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE) {
    signer = new P12Signer(p12Cert, { passphrase: process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE });
  }

  const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer);

  return signedPdf;
};
