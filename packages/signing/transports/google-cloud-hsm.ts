import fs from 'node:fs';

import { signWithGCloud } from '@documenso/pdf-sign';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';

export type SignWithGoogleCloudHSMOptions = {
  pdf: Buffer;
};

export const signWithGoogleCloudHSM = async ({ pdf }: SignWithGoogleCloudHSMOptions) => {
  const keyPath = process.env.NEXT_PRIVATE_SIGNING_GCLOUD_HSM_KEY_PATH;

  if (!keyPath) {
    throw new Error('No certificate path provided for Google Cloud HSM signing');
  }

  // To handle hosting in serverless environments like Vercel we can supply the base64 encoded
  // application credentials as an environment variable and write it to a file if it doesn't exist
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS
  ) {
    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      fs.writeFileSync(
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        Buffer.from(
          process.env.NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS,
          'base64',
        ),
      );
    }
  }

  const { pdf: pdfWithPlaceholder, byteRange } = updateSigningPlaceholder({
    pdf: await addSigningPlaceholder({ pdf }),
  });

  const pdfWithoutSignature = Buffer.concat([
    pdfWithPlaceholder.subarray(0, byteRange[1]),
    pdfWithPlaceholder.subarray(byteRange[2]),
  ]);

  const signatureLength = byteRange[2] - byteRange[1];

  let cert: Buffer | null = null;

  if (process.env.NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS) {
    cert = Buffer.from(
      process.env.NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS,
      'base64',
    );
  }

  if (!cert) {
    cert = Buffer.from(
      fs.readFileSync(
        process.env.NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_PATH || './example/cert.crt',
      ),
    );
  }

  const signature = signWithGCloud({
    keyPath,
    cert,
    content: pdfWithoutSignature,
  });

  const signatureAsHex = signature.toString('hex');

  const signedPdf = Buffer.concat([
    pdfWithPlaceholder.subarray(0, byteRange[1]),
    Buffer.from(`<${signatureAsHex.padEnd(signatureLength - 2, '0')}>`),
    pdfWithPlaceholder.subarray(byteRange[2]),
  ]);

  return signedPdf;
};
