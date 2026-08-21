import * as fs from 'node:fs';

import { getLocalSigningCertificateDefaultPath } from '@documenso/lib/constants/signing';
import { env } from '@documenso/lib/utils/env';
import { P12Signer } from '@libpdf/core';

const loadP12 = (): Uint8Array => {
  const localFileContents = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS');

  if (localFileContents) {
    return Buffer.from(localFileContents, 'base64');
  }

  // Mirrors the certificate status check: without an explicit path, production
  // falls back to the canonical /opt/documenso/cert.p12 mount so self-hosters
  // upgrading from v1 (where the mount alone was enough) keep working (#2773).
  const localFilePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || getLocalSigningCertificateDefaultPath();

  try {
    return fs.readFileSync(localFilePath);
  } catch {
    throw new Error(
      `No certificate found for local signing at ${localFilePath}. Set NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH, NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS, or mount a certificate at the default location.`
    );
  }
};

export const createLocalSigner = async () => {
  const p12 = loadP12();

  return await P12Signer.create(p12, env('NEXT_PRIVATE_SIGNING_PASSPHRASE') || '', {
    buildChain: true,
  });
};
