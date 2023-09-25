import signer from 'node-signpdf';
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

  if (process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE) {
    return signer.sign(pdfWithPlaceholder, p12Cert, {
      passphrase: process.env.NEXT_PRIVATE_SIGNING_PASSPHRASE,
    });
  }

  return signer.sign(pdfWithPlaceholder, p12Cert);
};
