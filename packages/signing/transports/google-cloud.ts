import { GoogleKmsSigner, parsePem } from '@libpdf/core';
import fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

const loadCertificates = async (): Promise<Uint8Array[]> => {
  // Try chain file first (takes precedence)
  const chainContents = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_CERT_CHAIN_CONTENTS');
  const chainFilePath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_CERT_CHAIN_FILE_PATH');

  if (chainContents) {
    return parsePem(Buffer.from(chainContents, 'base64').toString('utf-8')).map(
      (block) => block.der,
    );
  }

  if (chainFilePath) {
    return parsePem(fs.readFileSync(chainFilePath).toString('utf-8')).map((block) => block.der);
  }

  // Fall back to single certificate (existing behavior)
  const certContents = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS');
  const certFilePath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_PATH');

  if (certContents) {
    return parsePem(Buffer.from(certContents, 'base64').toString('utf-8')).map(
      (block) => block.der,
    );
  }

  if (certFilePath) {
    return parsePem(fs.readFileSync(certFilePath).toString('utf-8')).map((block) => block.der);
  }

  // Would use: NEXT_PRIVATE_SIGNING_GCLOUD_HSM_SECRET_MANAGER_CERT_PATH
  const certPath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_SECRET_MANAGER_CERT_PATH');

  if (certPath) {
    const { cert, chain } = await GoogleKmsSigner.getCertificateFromSecretManager(certPath);

    if (chain) {
      return [cert, ...chain];
    }

    return [cert];
  }

  throw new Error('No certificate found for Google Cloud HSM signing');
};

export const createGoogleCloudSigner = async () => {
  const keyPath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_KEY_PATH');

  if (!keyPath) {
    throw new Error('No key path provided for Google Cloud HSM signing');
  }

  const googleAuthCredentials = env('GOOGLE_APPLICATION_CREDENTIALS');
  const googleAuthCredentialContents = env(
    'NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS',
  );

  // To handle hosting in serverless environments like Vercel we can supply the base64 encoded
  // application credentials as an environment variable and write it to a file if it doesn't exist
  if (googleAuthCredentials && googleAuthCredentialContents) {
    if (!fs.existsSync(googleAuthCredentials)) {
      const contents = new Uint8Array(Buffer.from(googleAuthCredentialContents, 'base64'));

      fs.writeFileSync(googleAuthCredentials, contents);
    }
  }

  const certs = await loadCertificates();

  if (certs.length === 0) {
    throw new Error('No valid certificates found');
  }

  return GoogleKmsSigner.create({
    keyVersionName: keyPath,
    certificate: certs[0],
    certificateChain: certs.length > 1 ? certs.slice(1) : undefined,
    buildChain: true,
  });
};
