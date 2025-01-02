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

  const googleApplicationCredentials = env('GOOGLE_APPLICATION_CREDENTIALS');
  const googleApplicationCredentialsContents = env(
    'NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS',
  );

  // To handle hosting in serverless environments like Vercel we can supply the base64 encoded
  // application credentials as an environment variable and write it to a file if it doesn't exist
  if (googleApplicationCredentials && googleApplicationCredentialsContents) {
    if (!fs.existsSync(googleApplicationCredentials)) {
      const contents = new Uint8Array(Buffer.from(googleApplicationCredentialsContents, 'base64'));

      fs.writeFileSync(googleApplicationCredentials, contents);
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

  const googleCloudHsmPublicCrtFileContents = env(
    'NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS',
  );

  if (googleCloudHsmPublicCrtFileContents) {
    cert = Buffer.from(googleCloudHsmPublicCrtFileContents, 'base64');
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
