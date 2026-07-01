import * as fs from 'node:fs';
import { env } from '@documenso/lib/utils/env';
import { P12Signer } from '@libpdf/core';

const loadP12 = (): Uint8Array => {
  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    return Buffer.from(localFileContents, 'base64');
  }
  const defaultPath =
    env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12';
  const localFilePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;
  if (fs.existsSync(localFilePath)) {
    return fs.readFileSync(localFilePath);
  }
  throw new Error(`No certificate found for local signing. Tried: ${localFilePath}`);
};

export const createLocalSigner = async () => {
  const p12 = loadP12();

  return await P12Signer.create(p12, env('NEXT_PRIVATE_SIGNING_PASSPHRASE') || '', {
    buildChain: true,
  });
};
