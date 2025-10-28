import * as fs from 'node:fs';

import { env } from '@documenso/lib/utils/env';

export const getCertificateStatus = () => {
  if (env('NEXT_PRIVATE_SIGNING_TRANSPORT') !== 'local') {
    return { isAvailable: true };
  }

  if (env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS')) {
    return { isAvailable: true };
  }

  const defaultPath =
    env('NODE_ENV') === 'production' ? '/opt/documenso/cert.p12' : './example/cert.p12';

  const filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || defaultPath;

  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

    const stats = fs.statSync(filePath);

    return { isAvailable: stats.size > 0 };
  } catch {
    return { isAvailable: false };
  }
};
