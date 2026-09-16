import * as fs from 'node:fs';
import { env } from '@documenso/lib/utils/env';
import { P12Signer } from '@libpdf/core';

const loadP12 = (): Uint8Array => {
  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    return Buffer.from(localFileContents, 'base64');
  }

  const localFilePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH');

  if (localFilePath) {
    return fs.readFileSync(localFilePath);
  }

  if (env('NODE_ENV') !== 'production') {
    return fs.readFileSync('./example/cert.p12');
  }

  throw new Error('No certificate found for local signing');
};

export type CreateLocalSignerOptions = {
  /**
   * Fetch missing intermediates via AIA. Leave on for sealing.
   * Turn off for health checks so they do not hit the network.
   *
   * @default true
   */
  buildChain?: boolean;
};

export const createLocalSigner = async ({ buildChain = true }: CreateLocalSignerOptions = {}) => {
  const p12 = loadP12();

  return await P12Signer.create(p12, env('NEXT_PRIVATE_SIGNING_PASSPHRASE') || '', {
    buildChain,
  });
};
