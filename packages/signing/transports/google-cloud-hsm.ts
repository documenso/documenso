import fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';
import { signWithGCloud } from '@documenso/pdf-sign';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';

export type SignWithGoogleCloudHSMOptions = {
  pdf: Buffer;
};

export const signWithGoogleCloudHSM = async ({ pdf }: SignWithGoogleCloudHSMOptions) => {
  const keyPath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_KEY_PATH');

  if (!keyPath) {
    throw new Error('No certificate path provided for Google Cloud HSM signing');
  }

  // To handle hosting in serverless environments like Vercel we can supply the base64 encoded
  // application credentials as an environment variable and write it to a file if it doesn't exist
  if (
    env('GOOGLE_APPLICATION_CREDENTIALS') &&
    env('NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS')
  ) {
    if (!fs.existsSync(env('GOOGLE_APPLICATION_CREDENTIALS'))) {
      const contents = new Uint8Array(
        Buffer.from(env('NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS'), 'base64'),
      );

      fs.writeFileSync(env('GOOGLE_APPLICATION_CREDENTIALS'), contents);
    }
  }

  const { pdf: pdfWithPlaceholder, byteRange } = updateSigningPlaceholder({
    pdf: await addSigningPlaceholder({ pdf }),
  });

  const pdfWithoutSignature = Buffer.concat([
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  const signatureLength = byteRange[2] - byteRange[1];

  let cert: Buffer | null = null;

  if (env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS')) {
    cert = Buffer.from(env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS'), 'base64');
  }

  if (!cert) {
    cert = Buffer.from(
      fs.readFileSync(
        env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_PATH') || './example/cert.crt',
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
    new Uint8Array(pdfWithPlaceholder.subarray(0, byteRange[1])),
    new Uint8Array(Buffer.from(`<${signatureAsHex.padEnd(signatureLength - 2, '0')}>`)),
    new Uint8Array(pdfWithPlaceholder.subarray(byteRange[2])),
  ]);

  return signedPdf;
};
