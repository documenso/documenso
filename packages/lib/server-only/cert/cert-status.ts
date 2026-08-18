import * as fs from 'node:fs';

import { getLocalSigningCertificateDefaultPath } from '@documenso/lib/constants/signing';
import { env } from '@documenso/lib/utils/env';

export const getCertificateStatus = () => {
  if (env('NEXT_PRIVATE_SIGNING_TRANSPORT') !== 'local') {
    return { isAvailable: true };
  }

  if (env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS')) {
    return { isAvailable: true };
  }

  const filePath = env('NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH') || getLocalSigningCertificateDefaultPath();

  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);

    const stats = fs.statSync(filePath);

    return { isAvailable: stats.size > 0 };
  } catch {
    return { isAvailable: false };
  }
};
